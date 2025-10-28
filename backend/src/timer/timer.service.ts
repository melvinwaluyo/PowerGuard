import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TimerLogStatus, TimerSource } from '@prisma/client';
import { MqttService } from '../mqtt/mqtt.service';
import { PrismaService } from '../prisma.service';

export interface TimerStatus {
  outletId: number;
  isActive: boolean;
  durationSeconds: number | null;
  endsAt: Date | null;
  remainingSeconds: number;
  source: TimerSource | null;
}

interface StartTimerOptions {
  source?: TimerSource;
  note?: string;
  force?: boolean;
  allowReplace?: boolean;
}

interface StopTimerOptions {
  status?: TimerLogStatus;
  note?: string;
  expectedSource?: TimerSource;
  logWhenInactive?: boolean;
}

@Injectable()
export class TimerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimerService.name);
  private readonly scheduledTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  async onModuleInit() {
    await this.restoreTimers();
  }

  onModuleDestroy() {
    this.clearAllTimers();
  }

  private async shouldStartGeofenceTimer(powerstripID: number): Promise<boolean> {
    // Check if there are active outlets on this powerstrip
    const activeOutlets = await this.prisma.outlet.count({
      where: {
        powerstripID: powerstripID,
        state: true, // only count outlets that are on
      },
    });

    return activeOutlets > 0; // return true if at least 1 outlet is on
  }

  async startTimer(
    outletId: number,
    durationSeconds: number,
    options: StartTimerOptions = {},
  ): Promise<TimerStatus> {
    if (durationSeconds <= 0) {
      throw new BadRequestException('Duration must be greater than zero');
    }

    const source = options.source ?? TimerSource.MANUAL;
    const outlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: {
        outletID: true,
        state: true,
        timerIsActive: true,
        timerEndsAt: true,
        timerDuration: true,
        timerSource: true,
        powerstripID: true,
      },
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet ${outletId} not found`);
    }

    if (!outlet.state) {
      throw new BadRequestException('Timer can only be activated when outlet is ON');
    }

    if (outlet.timerIsActive) {
      if (outlet.timerSource === source || options.allowReplace) {
        await this.stopTimer(outletId, {
          status: TimerLogStatus.REPLACED,
          note: 'Timer replaced with new duration',
          logWhenInactive: false,
          expectedSource: outlet.timerSource ?? undefined,
        });
      } else if (options.force) {
        await this.stopTimer(outletId, {
          status: TimerLogStatus.REPLACED,
          note: 'Timer replaced (forced)',
          logWhenInactive: false,
        });
      } else {
        throw new BadRequestException(
          'Timer already active with different source. Cancel it first before starting a new one.',
        );
      }
    }

    const endsAt = new Date(Date.now() + durationSeconds * 1000);

    // Tambahkan cek khusus untuk timer geofencing
    if (options.source === TimerSource.GEOFENCE && outlet.powerstripID) {
      const shouldStart = await this.shouldStartGeofenceTimer(outlet.powerstripID);
      if (!shouldStart) {
        this.logger.log(
          `Geofence timer not started for outlet ${outletId} because no outlets are active`,
        );
        return this.buildStatus(outletId, false, durationSeconds, null, null);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.outlet.update({
        where: { outletID: outletId },
        data: {
          timerIsActive: true,
          timerDuration: durationSeconds,
          timerEndsAt: endsAt,
          timerSource: source,
        },
      });

      await tx.timerLog.create({
        data: {
          outletID: outletId,
          status: TimerLogStatus.STARTED,
          durationSeconds,
          remainingSeconds: durationSeconds,
          note: options.note ?? 'Timer started',
          source,
        },
      });
    });

    this.scheduleTimer(outletId, endsAt);
    this.logger.log(
      `Timer started for outlet ${outletId} (${durationSeconds}s) via ${source}`,
    );

    return this.buildStatus(outletId, true, durationSeconds, endsAt, source);
  }

  async stopTimer(outletId: number, options: StopTimerOptions = {}): Promise<TimerStatus> {
    const {
      status = TimerLogStatus.STOPPED,
      note,
      expectedSource,
      logWhenInactive = true,
    } = options;

    const outlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: {
        outletID: true,
        timerIsActive: true,
        timerEndsAt: true,
        timerDuration: true,
        timerSource: true,
      },
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet ${outletId} not found`);
    }

    if (!outlet.timerIsActive) {
      if (logWhenInactive) {
        this.logger.warn(`StopTimer called, but no active timer for outlet ${outletId}`);
      }
      return this.buildStatus(outletId, false, null, null, null);
    }

    if (expectedSource && outlet.timerSource && outlet.timerSource !== expectedSource) {
      this.logger.warn(
        `StopTimer for outlet ${outletId} ignored because current source is ${outlet.timerSource}, not ${expectedSource}`,
      );
      return this.buildStatus(
        outletId,
        outlet.timerIsActive ?? false,
        outlet.timerDuration ?? null,
        outlet.timerEndsAt ?? null,
        outlet.timerSource ?? null,
      );
    }

    const remainingSeconds = outlet.timerEndsAt
      ? Math.max(0, Math.round((outlet.timerEndsAt.getTime() - Date.now()) / 1000))
      : 0;

    this.clearScheduledTimer(outletId);

    await this.prisma.$transaction(async (tx) => {
      await tx.outlet.update({
        where: { outletID: outletId },
        data: {
          timerIsActive: false,
          timerDuration: outlet.timerDuration,
          timerEndsAt: null,
          timerSource: null,
        },
      });

      await tx.timerLog.create({
        data: {
          outletID: outletId,
          status,
          durationSeconds: outlet.timerDuration ?? undefined,
          remainingSeconds,
          note,
          source: outlet.timerSource ?? null,
        },
      });
    });

    this.logger.log(
      `Timer stopped for outlet ${outletId} with status ${status} (source: ${outlet.timerSource ?? 'unknown'})`,
    );
    return this.buildStatus(outletId, false, outlet.timerDuration ?? null, null, null);
  }

  async getTimerStatus(outletId: number): Promise<TimerStatus> {
    const outlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: {
        outletID: true,
        timerIsActive: true,
        timerEndsAt: true,
        timerDuration: true,
        timerSource: true,
      },
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet ${outletId} not found`);
    }

    return this.buildStatus(
      outletId,
      outlet.timerIsActive ?? false,
      outlet.timerDuration ?? null,
      outlet.timerEndsAt ?? null,
      outlet.timerSource ?? null,
    );
  }

  async getTimerLogs(outletId: number, limit = 20) {
    return this.prisma.timerLog.findMany({
      where: { outletID: outletId },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });
  }

  async updateTimerPreset(outletId: number, durationSeconds: number): Promise<TimerStatus> {
    if (durationSeconds <= 0) {
      throw new BadRequestException('Timer duration must be greater than zero seconds');
    }

    const outlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: {
        outletID: true,
        timerIsActive: true,
        timerDuration: true,
      },
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet ${outletId} not found`);
    }

    if (outlet.timerIsActive) {
      throw new BadRequestException('Cannot change duration while timer is running');
    }

    const hasChanged = outlet.timerDuration !== durationSeconds;

    await this.prisma.$transaction(async (tx) => {
      await tx.outlet.update({
        where: { outletID: outletId },
        data: {
          timerDuration: durationSeconds,
          timerIsActive: false,
          timerEndsAt: null,
          timerSource: null,
        },
      });

      if (hasChanged) {
        await tx.timerLog.create({
          data: {
            outletID: outletId,
            status: TimerLogStatus.REPLACED,
            durationSeconds,
            remainingSeconds: durationSeconds,
            note: 'Timer preset updated',
            source: null,
          },
        });
      }
    });

    this.logger.log(`Timer preset for outlet ${outletId} updated to ${durationSeconds}s`);
    return this.buildStatus(outletId, false, durationSeconds, null, null);
  }

  async handleOutletStateChange(outletId: number, isOn: boolean) {
    if (!isOn) {
      await this.stopTimer(outletId, {
        status: TimerLogStatus.POWER_OFF,
        note: 'Timer stopped because outlet was turned off',
        logWhenInactive: false,
      });
    }
  }

  async fulfillGeofenceAutoShutdown(outletId: number, powerstripID: number | null) {
    await this.safeTurnOffOutlet(outletId, TimerSource.GEOFENCE, powerstripID);
  }

  private scheduleTimer(outletId: number, endsAt: Date) {
    this.clearScheduledTimer(outletId);
    const delay = endsAt.getTime() - Date.now();
    if (delay <= 0) {
      void this.finishTimer(outletId);
      return;
    }

    const timeout = setTimeout(() => {
      void this.finishTimer(outletId);
    }, delay);

    this.scheduledTimers.set(outletId, timeout);
  }

  private clearScheduledTimer(outletId: number) {
    const timeout = this.scheduledTimers.get(outletId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledTimers.delete(outletId);
    }
  }

  private clearAllTimers() {
    for (const timeout of this.scheduledTimers.values()) {
      clearTimeout(timeout);
    }
    this.scheduledTimers.clear();
  }

  // relay turns off when timerEndsAt is reached
  private async finishTimer(outletId: number) {
    this.clearScheduledTimer(outletId);

    const outlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: {
        outletID: true,
        timerIsActive: true,
        timerEndsAt: true,
        timerDuration: true,
        timerSource: true,
        powerstripID: true,
      },
    });

    if (!outlet?.timerIsActive) {
      return;
    }

    // Log timer completion
    await this.prisma.$transaction(async (tx) => {
      await tx.timerLog.create({
        data: {
          outletID: outletId,
          status: TimerLogStatus.COMPLETED,
          durationSeconds: outlet.timerDuration ?? undefined,
          remainingSeconds: 0,
          note: 'Timer completed and relay turned off automatically',
          source: outlet.timerSource ?? null,
        },
      });

      // Reset status timer
      await tx.outlet.update({
        where: { outletID: outletId },
        data: {
          timerIsActive: false,
          timerDuration: outlet.timerDuration,
          timerEndsAt: null,
          timerSource: null,
        },
      });
    });

    // Turn off outlet
    this.logger.log(
      `Timer completed for outlet ${outletId}, turning off relay (source: ${outlet.timerSource ?? 'unknown'})`,
    );
    await this.safeTurnOffOutlet(outletId, outlet.timerSource ?? null, outlet.powerstripID ?? null);

    // Record notification ONLY for manual timers (not geofence)
    // Geofence notifications are handled in safeTurnOffOutlet
    if (outlet.timerSource !== TimerSource.GEOFENCE) {
      const outletName = await this.getOutletName(outletId);
      const durationMinutes = Math.round((outlet.timerDuration ?? 0) / 60);
      await this.recordNotification(
        outletId,
        `Timer completed: ${outletName} turned off after ${durationMinutes} minute(s)`,
      );
    }
  }

  private async getOutletName(outletId: number): Promise<string> {
    const outlet = await this.prisma.outlet.findUnique({
      where: { outletID: outletId },
      select: { name: true, index: true },
    });
    return outlet?.name || `Outlet ${outlet?.index || outletId}`;
  }

  private async safeTurnOffOutlet(
    outletId: number,
    source: TimerSource | null,
    powerstripID: number | null
  ) {
    try {
      // If timer originated from geofencing and has powerstripID
      if (source === TimerSource.GEOFENCE && powerstripID) {
        // Get all outlets that are still on from the same powerstrip
        const activeOutlets = await this.prisma.outlet.findMany({
          where: {
            powerstripID: powerstripID,
            state: true, // only outlets that are still on
          },
          select: {
            outletID: true,
            name: true,
            index: true,
          },
        });

        if (activeOutlets.length === 0) {
          await this.prisma.geofenceSetting.updateMany({
            where: { powerstripID },
            data: {
              countdownIsActive: false,
              countdownEndsAt: null,
              countdownStartedAt: null,
              lastAutoShutdownAt: new Date(),
            },
          });
          this.logger.log(
            `Geofence timer completed: no active outlets for powerstrip ${powerstripID}`
          );
          return;
        }

        const outletIds = activeOutlets.map((outlet) => outlet.outletID);

        await this.prisma.$transaction(async (tx) => {
          await tx.outlet.updateMany({
            where: {
              outletID: {
                in: outletIds,
              },
            },
            data: {
              state: false,
              timerIsActive: false,
              timerEndsAt: null,
              timerSource: null,
            },
          });
        });

        await Promise.all(
          activeOutlets.map((outlet) => this.mqttService.controlOutlet(outlet.outletID, false)),
        );

        // Record ONE notification for ALL outlets (not per outlet)
        // Only record if there were outlets to turn off
        const outletNames = activeOutlets
          .map((o) => o.name || `Outlet ${o.index || o.outletID}`)
          .join(', ');

        // Record notification to the first outlet (or any outlet in the powerstrip)
        await this.recordNotification(
          activeOutlets[0].outletID,
          `Geofence auto-shutdown: ${activeOutlets.length} outlet(s) turned off (${outletNames})`,
        );

        // Update geofence status
        await this.prisma.geofenceSetting.updateMany({
          where: { powerstripID },
          data: {
            countdownIsActive: false,
            countdownEndsAt: null,
            countdownStartedAt: null,
            lastAutoShutdownAt: new Date(),
          },
        });

        this.logger.log(
          `Geofence timer completed: ${activeOutlets.length} outlet(s) turned off for powerstrip ${powerstripID}`
        );
      } else {
        // Logic for non-geofencing timer remains the same
        await this.mqttService.controlOutlet(outletId, false);
      }
    } catch (error) {
      // Error handling remains the same
      const err = error as Error;
      this.logger.error(
        `Failed to turn off outlet ${outletId} after timer completed: ${err.message}`,
        err.stack
      );
      await this.prisma.timerLog.create({
        data: {
          outletID: outletId,
          status: TimerLogStatus.AUTO_CANCELLED,
          note: 'Failed to send MQTT command to turn off outlet',
        },
      });
    }
  }

  private async restoreTimers() {
    const activeTimers = await this.prisma.outlet.findMany({
      where: {
        timerIsActive: true,
        timerEndsAt: {
          not: null,
        },
      },
      select: {
        outletID: true,
        timerEndsAt: true,
      },
    });

    if (activeTimers.length) {
      this.logger.log(`Restoring ${activeTimers.length} outlet timer(s) from database`);

      for (const timer of activeTimers) {
        if (!timer.timerEndsAt) continue;

        const delay = timer.timerEndsAt.getTime() - Date.now();
        if (delay <= 0) {
          void this.finishTimer(timer.outletID);
        } else {
          const timeout = setTimeout(() => {
            void this.finishTimer(timer.outletID);
          }, delay);
          this.scheduledTimers.set(timer.outletID, timeout);
        }
      }
    }
  }

  private buildStatus(
    outletId: number,
    isActive: boolean,
    durationSeconds: number | null,
    endsAt: Date | null,
    source: TimerSource | null,
  ): TimerStatus {
    const remainingSeconds =
      isActive && endsAt ? Math.max(0, Math.round((endsAt.getTime() - Date.now()) / 1000)) : 0;

    return {
      outletId,
      isActive,
      durationSeconds,
      endsAt,
      remainingSeconds,
      source,
    };
  }

  private async recordNotification(outletId: number, message: string) {
    await this.prisma.notificationLog.create({
      data: {
        outletID: outletId,
        message,
      },
    });
  }
}
