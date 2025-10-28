import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: MqttClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
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

        // Skip storing if any value is null or if power is 0 (outlet is OFF or incomplete data)
        // This prevents database flooding with useless or incomplete entries
        if (current === null || power === null || energy === null || power === 0) {
          console.log(`Skipped storing for outlet ${outletId} (current: ${current}A, power: ${power}W, energy: ${energy}Wh - incomplete or zero data)`);
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

        console.log(`Stored usage data for outlet ${outletId}: ${power}W, ${current}A`);
      }

      // Handle timer status: powerguard/{outlet_id}/timer/status
      if (parts[0] === 'powerguard' && parts[2] === 'timer' && parts[3] === 'status') {
        const outletId = parseInt(parts[1]);
        await this.handleTimerStatus(outletId, data);
      }
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }

  private async handleTimerStatus(outletId: number, data: any) {
    const isActive = data.isActive === true;
    const remainingSeconds = typeof data.remainingSeconds === 'number' ? data.remainingSeconds : 0;
    const durationSeconds = typeof data.durationSeconds === 'number' ? data.durationSeconds : 0;
    const source = data.source || null;

    console.log(`Timer status for outlet ${outletId}: active=${isActive}, remaining=${remainingSeconds}s`);

    // Get current outlet state to detect timer completion
    const currentOutlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: {
        timerIsActive: true,
        timerDuration: true,
        timerSource: true,
        name: true,
        index: true,
        powerstripID: true
      }
    });

    // Detect timer completion (was active, now inactive with 0 remaining)
    const timerJustCompleted =
      currentOutlet?.timerIsActive === true &&
      isActive === false &&
      remainingSeconds === 0 &&
      durationSeconds > 0;

    // Calculate timerEndsAt from remaining seconds
    const timerEndsAt = isActive && remainingSeconds > 0
      ? new Date(Date.now() + (remainingSeconds * 1000))
      : null;

    // Update database with timer status from STM32
    await this.prisma.outlet.update({
      where: { outletID: outletId },
      data: {
        timerIsActive: isActive,
        timerDuration: durationSeconds > 0 ? durationSeconds : null,
        timerEndsAt,
        timerSource: source,
        // If timer just completed, also update outlet state to OFF
        ...(timerJustCompleted && { state: false })
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
          source: currentOutlet?.timerSource ?? null
        }
      });

      // Handle notifications based on timer source
      if (currentOutlet?.timerSource === 'GEOFENCE') {
        // For GEOFENCE timers, create ONE consolidated notification for all outlets
        await this.handleGeofenceTimerCompletion(outletId, currentOutlet);
      } else {
        // For MANUAL timers, create individual notification
        const outletName = currentOutlet?.name || `Outlet ${currentOutlet?.index || outletId}`;
        const durationMinutes = Math.round((currentOutlet?.timerDuration ?? durationSeconds) / 60);

        await this.prisma.notificationLog.create({
          data: {
            outletID: outletId,
            message: `Timer completed: ${outletName} turned off after ${durationMinutes} minute(s)`
          }
        });
      }

      console.log(`✅ Timer completed for outlet ${outletId} - state updated, logs created`);
    }
  }

  private async handleGeofenceTimerCompletion(outletId: number, currentOutlet: any) {
    // Check if this is the last active geofence timer for this powerstrip
    const powerstripID = currentOutlet.powerstripID;
    if (!powerstripID) return;

    // Count remaining active geofence timers for this powerstrip
    const remainingGeofenceTimers = await this.prisma.outlet.count({
      where: {
        powerstripID,
        timerIsActive: true,
        timerSource: 'GEOFENCE',
        outletID: { not: outletId } // Exclude current outlet (already marked inactive)
      }
    });

    // If this was the last geofence timer, create consolidated notification
    if (remainingGeofenceTimers === 0) {
      // Get all outlets that were just turned off by geofence
      const recentlyTurnedOffOutlets = await this.prisma.outlet.findMany({
        where: {
          powerstripID,
          state: false,
          timerLogs: {
            some: {
              status: 'COMPLETED',
              source: 'GEOFENCE',
              triggeredAt: {
                gte: new Date(Date.now() - 60000) // Within last minute
              }
            }
          }
        },
        select: {
          outletID: true,
          name: true,
          index: true
        }
      });

      if (recentlyTurnedOffOutlets.length > 0) {
        const outletNames = recentlyTurnedOffOutlets
          .map(o => o.name || `Outlet ${o.index || o.outletID}`)
          .join(', ');

        await this.prisma.notificationLog.create({
          data: {
            outletID: recentlyTurnedOffOutlets[0].outletID,
            message: `Geofence auto-shutdown: ${recentlyTurnedOffOutlets.length} outlet(s) turned off (${outletNames})`
          }
        });

        console.log(`✅ Geofence consolidated notification created for ${recentlyTurnedOffOutlets.length} outlets`);
      }
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

    // Update database - if turning OFF, also clear timer fields to prevent UI showing stale countdown
    await this.prisma.outlet.update({
      where: { outletID: outletId },
      data: {
        state,
        // Clear timer fields when turning OFF (prevents race condition with UI showing timer on OFF outlet)
        ...(state === false && {
          timerIsActive: false,
          timerEndsAt: null,
          timerSource: null,
        }),
      },
    });
  }

  // Method to start timer on STM32
  publishTimerStart(outletId: number, durationSeconds: number, source: string): void {
    const topic = `powerguard/${outletId}/timer/start`;
    const message = JSON.stringify({ durationSeconds, source });
    this.publish(topic, message);
    console.log(`Published timer start command for outlet ${outletId}: ${durationSeconds}s`);
  }

  // Method to stop timer on STM32
  publishTimerStop(outletId: number, reason: string = 'cancelled'): void {
    const topic = `powerguard/${outletId}/timer/stop`;
    const message = JSON.stringify({ reason });
    this.publish(topic, message);
    console.log(`Published timer stop command for outlet ${outletId}`);
  }
}
