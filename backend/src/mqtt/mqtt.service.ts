import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { PrismaService } from '../prisma.service';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: MqttClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private fcmService: FcmService,
  ) {}

  async onModuleInit() {
    const server = this.configService.get<string>('MQTT_SERVER');
    const port = this.configService.get<number>('MQTT_PORT');
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const mqttOptions: any = {};

    // Only add credentials if they are provided
    if (username) {
      mqttOptions.username = username;
    }
    if (password) {
      mqttOptions.password = password;
    }

    this.client = mqtt.connect(`mqtt://${server}:${port}`, mqttOptions);

    this.client.on('connect', () => {
      console.log('Connected to EMQX MQTT broker');
      // Subscribe to power data topics
      this.client.subscribe('powerguard/+/data', (err) => {
        if (err) {
          console.error('Failed to subscribe to topics:', err);
        } else {
          console.log('Subscribed to powerguard/+/data');
        }
      });
      // Subscribe to timer status updates from STM32
      this.client.subscribe('powerguard/+/timer/status', (err) => {
        if (err) {
          console.error('Failed to subscribe to timer status topics:', err);
        } else {
          console.log('Subscribed to powerguard/+/timer/status');
        }
      });
    });

    this.client.on('message', async (topic, message) => {
      await this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      console.error('MQTT connection error:', error);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      this.client.end();
      console.log('Disconnected from EMQX MQTT broker');
    }
  }

  private async handleMessage(topic: string, message: Buffer) {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received MQTT message:', { topic, data });

      const parts = topic.split('/');

      // Handle power data: powerguard/{outlet_id}/data
      if (parts[0] === 'powerguard' && parts[2] === 'data') {
        const outletId = parseInt(parts[1]);

        // Extract values with proper null handling
        const current = typeof data.current === 'number' ? data.current : null;
        const power = typeof data.power === 'number' ? data.power : null;
        const energy = typeof data.energy === 'number' ? data.energy : null;
        const state = typeof data.state === 'boolean' ? data.state : null;

        // Handle state sync from physical button press
        if (state !== null) {
          await this.syncOutletStateFromHardware(outletId, state);
        }

        // Update runtime for this outlet (if it's ON)
        await this.updateOutletRuntime(outletId);

        // Skip storing if any value is null or if power is 0 (outlet is OFF or incomplete data)
        // This prevents database flooding with useless or incomplete entries
        if (
          current === null ||
          power === null ||
          energy === null ||
          power === 0
        ) {
          console.log(
            `Skipped storing for outlet ${outletId} (current: ${current}A, power: ${power}W, energy: ${energy}Wh - incomplete or zero data)`,
          );
          return;
        }

        // Store usage data in database (only meaningful data with power > 0)
        await this.prisma.usageLog.create({
          data: {
            outletID: outletId,
            current,
            power,
            energy,
          },
        });

        console.log(
          `Stored usage data for outlet ${outletId}: ${power}W, ${current}A`,
        );
      }

      // Handle timer status: powerguard/{outlet_id}/timer/status
      if (
        parts[0] === 'powerguard' &&
        parts[2] === 'timer' &&
        parts[3] === 'status'
      ) {
        const outletId = parseInt(parts[1]);
        await this.handleTimerStatus(outletId, data);
      }
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }

  private async handleTimerStatus(outletId: number, data: any) {
    const isActive = data.isActive === true;
    const remainingSeconds =
      typeof data.remainingSeconds === 'number' ? data.remainingSeconds : 0;
    const durationSeconds =
      typeof data.durationSeconds === 'number' ? data.durationSeconds : 0;
    const source = data.source || null;

    console.log(`[MQTT] Timer status received for outlet ${outletId}:`, {
      isActive,
      remainingSeconds,
      durationSeconds,
      source,
      rawData: data,
    });

    // Get current outlet state to detect timer completion
    const currentOutlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: {
        timerIsActive: true,
        timerDuration: true,
        timerSource: true,
        timerEndsAt: true,
        name: true,
        index: true,
        powerstripID: true,
      },
    });

    // Detect timer completion (was active, now inactive with 0 remaining)
    const timerJustCompleted =
      currentOutlet?.timerIsActive === true &&
      isActive === false &&
      remainingSeconds === 0 &&
      durationSeconds > 0;

    // Calculate timerEndsAt from remaining seconds
    // IMPORTANT: Only calculate if timer is newly activated OR if no endsAt exists
    // Don't recalculate on every status update to prevent time drift
    let timerEndsAt: Date | null = null;
    if (isActive && remainingSeconds > 0) {
      if (!currentOutlet?.timerIsActive || !currentOutlet?.timerEndsAt) {
        // Timer is newly starting, calculate endsAt
        timerEndsAt = new Date(Date.now() + remainingSeconds * 1000);
        console.log(
          `Timer starting for outlet ${outletId}: endsAt=${timerEndsAt.toISOString()}`,
        );
      } else {
        // Timer already active, keep existing endsAt to prevent drift
        timerEndsAt = currentOutlet.timerEndsAt;
      }
    }

    // Update database with timer status from STM32
    await this.prisma.outlet.update({
      where: { outletID: outletId },
      data: {
        timerIsActive: isActive,
        timerDuration: durationSeconds > 0 ? durationSeconds : null,
        timerEndsAt,
        timerSource: source,
        // If timer just completed, also update outlet state to OFF
        ...(timerJustCompleted && { state: false }),
      },
    });

    // If timer just completed, record timer log and notification
    if (timerJustCompleted) {
      // Create timer completion log
      await this.prisma.timerLog.create({
        data: {
          outletID: outletId,
          status: 'COMPLETED',
          durationSeconds: currentOutlet?.timerDuration ?? undefined,
          remainingSeconds: 0,
          note: 'Timer completed and outlet turned off automatically',
          source: currentOutlet?.timerSource ?? null,
        },
      });

      // Handle notifications based on timer source
      if (currentOutlet?.timerSource === 'GEOFENCE') {
        // For GEOFENCE timers, create ONE consolidated notification for all outlets
        await this.handleGeofenceTimerCompletion(outletId, currentOutlet);
      } else {
        // For MANUAL timers, create individual notification
        const outletName =
          currentOutlet?.name || `Outlet ${currentOutlet?.index || outletId}`;
        const totalSeconds = currentOutlet?.timerDuration ?? durationSeconds;

        // Format duration based on length
        let durationText: string;
        if (totalSeconds < 60) {
          durationText = `${totalSeconds} second(s)`;
        } else if (totalSeconds < 3600) {
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          durationText =
            seconds > 0
              ? `${minutes} minute(s) ${seconds} second(s)`
              : `${minutes} minute(s)`;
        } else {
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          durationText =
            minutes > 0
              ? `${hours} hour(s) ${minutes} minute(s)`
              : `${hours} hour(s)`;
        }

        const message = `Timer completed: ${outletName} turned off after ${durationText}`;

        await this.prisma.notificationLog.create({
          data: {
            outletID: outletId,
            message,
          },
        });

        // Send FCM notification for manual timer completion
        const outlet = await this.prisma.outlet.findUnique({
          where: { outletID: outletId },
          select: { powerstripID: true },
        });

        if (outlet?.powerstripID) {
          const tokens = await this.fcmService.getTokensForPowerstrip(
            outlet.powerstripID,
          );
          if (tokens.length > 0) {
            await this.fcmService.sendToMultipleDevices(
              tokens,
              'Timer Completed',
              message,
              {
                type: 'timer_completed',
                outletId: outletId.toString(),
                source: 'manual',
              },
              false, // Not critical
              'app-notifications-v2', // Use app notifications channel
            );
            console.log(
              `[FCM] Sent manual timer completion notification to ${tokens.length} device(s)`,
            );
          }
        }
      }

      console.log(
        `✅ Timer completed for outlet ${outletId} - state updated, logs created`,
      );
    }
  }

  private async handleGeofenceTimerCompletion(
    outletId: number,
    currentOutlet: any,
  ) {
    const powerstripID = currentOutlet.powerstripID;
    if (!powerstripID) return;

    // Check if there are any remaining active geofence timers for this powerstrip
    const remainingGeofenceTimers = await this.prisma.outlet.count({
      where: {
        powerstripID,
        timerIsActive: true,
        timerSource: 'GEOFENCE',
        outletID: { not: outletId }, // Exclude current outlet (already marked inactive)
      },
    });

    // Log total geofence timers (including the one that just completed)
    const totalGeofenceTimersBefore = remainingGeofenceTimers + 1;
    console.log(
      `[Geofence Timer] Outlet ${outletId} completed. Total geofence timers that were active: ${totalGeofenceTimersBefore}, Remaining: ${remainingGeofenceTimers}`,
    );

    // Only send notification when this is the LAST geofence timer to complete
    if (remainingGeofenceTimers === 0) {
      // Get all outlets that were recently turned off by geofence timers
      // Use a generous time window (3 minutes) to capture all outlets
      const recentlyTurnedOffOutlets = await this.prisma.outlet.findMany({
        where: {
          powerstripID,
          state: false,
          timerLogs: {
            some: {
              status: 'COMPLETED',
              source: 'GEOFENCE',
              triggeredAt: {
                gte: new Date(Date.now() - 180000), // Within last 3 minutes
              },
            },
          },
        },
        select: {
          outletID: true,
          name: true,
          index: true,
        },
      });

      console.log(
        `[Geofence Timer] Found ${recentlyTurnedOffOutlets.length} outlets that were turned off by geofence:`,
        recentlyTurnedOffOutlets.map(
          (o) => `${o.outletID} (${o.name || 'Outlet ' + o.index})`,
        ),
      );

      if (recentlyTurnedOffOutlets.length > 0) {
        const outletNames = recentlyTurnedOffOutlets
          .map((o) => o.name || `Outlet ${o.index || o.outletID}`)
          .join(', ');

        const title = 'Geofence Auto-Shutdown';
        const message = `Turned off ${recentlyTurnedOffOutlets.length} outlet${recentlyTurnedOffOutlets.length > 1 ? 's' : ''} (${outletNames})`;
        const fullMessage = `${title}: ${message}`;

        console.log(
          `[Geofence Timer] Preparing notification - Title: "${title}", Message: "${message}"`,
        );

        // Create notification log
        await this.prisma.notificationLog.create({
          data: {
            outletID: recentlyTurnedOffOutlets[0].outletID,
            message: fullMessage,
          },
        });

        // Send FCM notification
        const tokens =
          await this.fcmService.getTokensForPowerstrip(powerstripID);
        console.log(
          `[Geofence Timer] Found ${tokens.length} FCM token(s) for powerstrip ${powerstripID}`,
        );

        if (tokens.length > 0) {
          try {
            const result = await this.fcmService.sendToMultipleDevices(
              tokens,
              title,
              message,
              {
                type: 'geofence_timer_completed',
                outletCount: recentlyTurnedOffOutlets.length.toString(),
                powerstripId: powerstripID.toString(),
              },
              false, // Not critical
              'app-notifications-v2', // Use same channel as manual timers
            );
            console.log(
              `[FCM] ✅ Sent geofence timer completion notification for ${recentlyTurnedOffOutlets.length} outlet(s) to ${tokens.length} device(s)`,
            );
            if (result) {
              console.log(
                `[FCM] Success: ${result.successCount}/${tokens.length}, Failures: ${result.failureCount}`,
              );
            }
          } catch (error) {
            console.error(
              `[FCM] ❌ Error sending geofence notification:`,
              error,
            );
          }
        } else {
          console.warn(
            `[FCM] ⚠️  No FCM tokens found for powerstrip ${powerstripID} - notification not sent`,
          );
        }

        console.log(
          `✅ Geofence consolidated notification created for ${recentlyTurnedOffOutlets.length} outlets`,
        );
      } else {
        console.warn(`[Geofence Timer] ⚠️  No outlets found to notify about`);
      }
    } else {
      console.log(
        `⏳ Waiting for ${remainingGeofenceTimers} more geofence timer(s) to complete before sending notification`,
      );
    }
  }

  /**
   * Synchronize outlet state when physical button is pressed on STM32
   * Handles state changes initiated by hardware, not by app
   * Cancels timers if outlet is turned OFF physically
   */
  private async syncOutletStateFromHardware(
    outletId: number,
    newState: boolean,
  ) {
    try {
      // Get current outlet state from database
      const outlet = await this.prisma.outlet.findUnique({
        where: { outletID: outletId },
        select: {
          state: true,
          timerIsActive: true,
          timerDuration: true,
          timerSource: true,
          timerEndsAt: true,
          name: true,
          index: true,
        },
      });

      if (!outlet) {
        console.error(`Outlet ${outletId} not found in database`);
        return;
      }

      // Check if state has changed
      if (outlet.state === newState) {
        // State unchanged, no action needed
        return;
      }

      console.log(
        `🔘 Physical button pressed: Outlet ${outletId} ${newState ? 'ON' : 'OFF'} (was ${outlet.state ? 'ON' : 'OFF'})`,
      );

      // Determine if timer needs to be cancelled
      const shouldCancelTimer = !newState && outlet.timerIsActive === true;

      // Update outlet state in database
      const updateData: any = {
        state: newState,
      };

      // If turning ON, initialize runtime tracking
      if (newState === true) {
        updateData.lastRuntimeUpdate = new Date();
      }

      // If turning OFF, reset runtime and clear timer if active
      if (newState === false) {
        updateData.runtime = 0;
        updateData.lastRuntimeUpdate = null;

        if (shouldCancelTimer) {
          updateData.timerIsActive = false;
          updateData.timerEndsAt = null;
          updateData.timerSource = null;
        }
      }

      await this.prisma.outlet.update({
        where: { outletID: outletId },
        data: updateData,
      });

      // Create timer log if timer was cancelled
      if (shouldCancelTimer) {
        const remainingSeconds = outlet.timerEndsAt
          ? Math.max(
              0,
              Math.floor((outlet.timerEndsAt.getTime() - Date.now()) / 1000),
            )
          : 0;

        await this.prisma.timerLog.create({
          data: {
            outletID: outletId,
            status: 'POWER_OFF',
            durationSeconds: outlet.timerDuration ?? undefined,
            remainingSeconds,
            note: 'Timer cancelled - outlet turned OFF by physical button',
            source: outlet.timerSource ?? null,
          },
        });

        // Publish timer stop command to STM32 (sync hardware state)
        this.publishTimerStop(outletId, 'physical_button');

        const outletName = outlet.name || `Outlet ${outlet.index || outletId}`;
        console.log(
          `⏱️  Timer cancelled for ${outletName} (physical button OFF)`,
        );
      }

      console.log(
        `✅ Outlet ${outletId} state synced: ${newState ? 'ON' : 'OFF'}${shouldCancelTimer ? ' (timer cancelled)' : ''}`,
      );
    } catch (error) {
      console.error(`Failed to sync state for outlet ${outletId}:`, error);
    }
  }

  /**
   * Update outlet runtime counter using timestamp-based tracking
   * Called every time we receive power data (interval-agnostic)
   * Calculates elapsed time since last update if outlet is ON
   */
  private async updateOutletRuntime(outletId: number) {
    try {
      // Get current outlet state and last update time
      const outlet = await this.prisma.outlet.findUnique({
        where: { outletID: outletId },
        select: { state: true, runtime: true, lastRuntimeUpdate: true },
      });

      // Only increment runtime if outlet is ON
      if (outlet?.state === true) {
        const now = new Date();
        const lastUpdate = outlet.lastRuntimeUpdate || now;

        // Calculate seconds elapsed since last update
        const secondsElapsed = Math.floor(
          (now.getTime() - lastUpdate.getTime()) / 1000,
        );

        // Only update if at least 1 second has passed (prevent duplicate updates)
        if (secondsElapsed > 0) {
          const currentRuntime = outlet.runtime ?? 0;
          const newRuntime = currentRuntime + secondsElapsed;

          await this.prisma.outlet.update({
            where: { outletID: outletId },
            data: {
              runtime: newRuntime,
              lastRuntimeUpdate: now,
            },
          });

          // Log every minute (when runtime crosses a minute boundary)
          if (Math.floor(newRuntime / 60) > Math.floor(currentRuntime / 60)) {
            console.log(
              `⏱️  Outlet ${outletId} runtime: ${Math.floor(newRuntime / 60)} minutes`,
            );
          }
        }
      }
    } catch (error) {
      // Don't throw error, just log - runtime tracking shouldn't break data collection
      console.error(`Failed to update runtime for outlet ${outletId}:`, error);
    }
  }

  // Method to publish messages to MQTT
  publish(topic: string, message: string): void {
    if (this.client && this.client.connected) {
      this.client.publish(topic, message, (err) => {
        if (err) {
          console.error('Failed to publish message:', err);
        }
      });
    }
  }

  // Method to control outlet state
  async controlOutlet(outletId: number, state: boolean): Promise<void> {
    const topic = `powerguard/${outletId}/control`;
    const message = JSON.stringify({ state });
    this.publish(topic, message);

    // Update database - if turning OFF, also clear timer fields and reset runtime
    await this.prisma.outlet.update({
      where: { outletID: outletId },
      data: {
        state,
        // When turning ON, set lastRuntimeUpdate to now (start tracking)
        ...(state === true && {
          lastRuntimeUpdate: new Date(),
        }),
        // Clear timer fields when turning OFF (prevents race condition with UI showing timer on OFF outlet)
        // Reset runtime to 0 when turning OFF (ready for next power-on session)
        ...(state === false && {
          timerIsActive: false,
          timerEndsAt: null,
          timerSource: null,
          runtime: 0,
          lastRuntimeUpdate: null,
        }),
      },
    });

    console.log(
      `Outlet ${outletId} turned ${state ? 'ON' : 'OFF'}${state === false ? ' - runtime reset' : ''}`,
    );
  }

  // Method to start timer on STM32
  publishTimerStart(
    outletId: number,
    durationSeconds: number,
    source: string,
  ): void {
    const topic = `powerguard/${outletId}/timer/start`;
    const message = JSON.stringify({ durationSeconds, source });
    this.publish(topic, message);
    console.log(
      `Published timer start command for outlet ${outletId}: ${durationSeconds}s`,
    );
  }

  // Method to stop timer on STM32
  publishTimerStop(outletId: number, reason: string = 'cancelled'): void {
    const topic = `powerguard/${outletId}/timer/stop`;
    const message = JSON.stringify({ reason });
    this.publish(topic, message);
    console.log(`Published timer stop command for outlet ${outletId}`);
  }
}
