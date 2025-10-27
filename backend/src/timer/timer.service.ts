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
    // Cek apakah ada outlet yang aktif pada powerstrip tersebut
    const activeOutlets = await this.prisma.outlet.count({
      where: {
        powerstripID: powerstripID,
        state: true, // hanya hitung outlet yang menyala
      },
    });

    return activeOutlets > 0; // return true jika ada minimal 1 outlet yang nyala
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
      throw new BadRequestException('Timer hanya dapat diaktifkan saat outlet dalam keadaan ON');
    }

    if (outlet.timerIsActive) {
      if (outlet.timerSource === source || options.allowReplace) {
        await this.stopTimer(outletId, {
          status: TimerLogStatus.REPLACED,
          note: 'Timer diganti dengan durasi baru',
          logWhenInactive: false,
          expectedSource: outlet.timerSource ?? undefined,
        });
      } else if (options.force) {
        await this.stopTimer(outletId, {
          status: TimerLogStatus.REPLACED,
          note: 'Timer diganti (force)',
          logWhenInactive: false,
        });
      } else {
        throw new BadRequestException(
          'Timer sudah aktif dengan sumber berbeda. Batalkan terlebih dahulu sebelum memulai yang baru.',
        );
      }
    }

    const endsAt = new Date(Date.now() + durationSeconds * 1000);

    // Tambahkan cek khusus untuk timer geofencing
    if (options.source === TimerSource.GEOFENCE && outlet.powerstripID) {
      const shouldStart = await this.shouldStartGeofenceTimer(outlet.powerstripID);
      if (!shouldStart) {
        this.logger.log(
          `Geofence timer tidak dimulai untuk outlet ${outletId} karena tidak ada outlet yang aktif`,
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
          note: options.note ?? 'Timer dimulai',
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
        this.logger.warn(`StopTimer dipanggil, namun tidak ada timer aktif untuk outlet ${outletId}`);
      }
      return this.buildStatus(outletId, false, null, null, null);
    }

    if (expectedSource && outlet.timerSource && outlet.timerSource !== expectedSource) {
      this.logger.warn(
        `StopTimer untuk outlet ${outletId} diabaikan karena sumber saat ini ${outlet.timerSource}, bukan ${expectedSource}`,
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
      `Timer dihentikan untuk outlet ${outletId} dengan status ${status} (source: ${outlet.timerSource ?? 'unknown'})`,
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
      throw new BadRequestException('Durasi timer harus lebih dari nol detik');
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
      throw new NotFoundException(`Outlet ${outletId} tidak ditemukan`);
    }

    if (outlet.timerIsActive) {
      throw new BadRequestException('Tidak dapat mengubah durasi ketika timer sedang berjalan');
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
            note: 'Preset timer diperbarui',
            source: null,
          },
        });
      }
    });

    this.logger.log(`Timer preset di-outlet ${outletId} diperbarui menjadi ${durationSeconds}s`);
    return this.buildStatus(outletId, false, durationSeconds, null, null);
  }

  async handleOutletStateChange(outletId: number, isOn: boolean) {
    if (!isOn) {
      await this.stopTimer(outletId, {
        status: TimerLogStatus.POWER_OFF,
        note: 'Timer dihentikan karena outlet dimatikan',
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

  // relay mati ketika timerEndsAt == TRUE
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

    // Catat log timer selesai
    await this.prisma.$transaction(async (tx) => {
      await tx.timerLog.create({
        data: {
          outletID: outletId,
          status: TimerLogStatus.COMPLETED,
          durationSeconds: outlet.timerDuration ?? undefined,
          remainingSeconds: 0,
          note: 'Timer selesai dan relay dimatikan otomatis',
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

    // Matikan outlet
    this.logger.log(
      `Timer selesai untuk outlet ${outletId}, mematikan relay (source: ${outlet.timerSource ?? 'unknown'})`,
    );
    await this.safeTurnOffOutlet(outletId, outlet.timerSource ?? null, outlet.powerstripID ?? null);
  }

  private async safeTurnOffOutlet(
    outletId: number, 
    source: TimerSource | null,
    powerstripID: number | null
  ) {
    try {
      // Jika timer berasal dari geofencing dan ada powerstripID
      if (source === TimerSource.GEOFENCE && powerstripID) {
        // Ambil semua outlet yang masih menyala dari powerstrip yang sama
        const activeOutlets = await this.prisma.outlet.findMany({
          where: {
            powerstripID: powerstripID,
            state: true, // hanya yang masih menyala
          },
          select: {
            outletID: true,
          },
        });

        // Matikan semua outlet yang aktif secara bersamaan
        for (const outlet of activeOutlets) {
          await this.mqttService.controlOutlet(outlet.outletID, false);
          
          // Update status outlet di database
          await this.prisma.outlet.update({
            where: { outletID: outlet.outletID },
            data: { 
              state: false,
              timerIsActive: false,
              timerEndsAt: null,
              timerSource: null
            }
          });

          // Catat notifikasi untuk setiap outlet
          await this.recordNotification(
            outlet.outletID,
            'Auto shutdown: Outlet dimatikan karena timer geofence selesai.'
          );
        }

        // Update status geofence
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
          `Geofence timer selesai: ${activeOutlets.length} outlet dimatikan untuk powerstrip ${powerstripID}`
        );
      } else {
        // Logika untuk timer non-geofencing tetap sama
        await this.mqttService.controlOutlet(outletId, false);
      }
    } catch (error) {
      // Error handling tetap sama
      const err = error as Error;
      this.logger.error(
        `Gagal mematikan outlet ${outletId} setelah timer selesai: ${err.message}`,
        err.stack
      );
      await this.prisma.timerLog.create({
        data: {
          outletID: outletId,
          status: TimerLogStatus.AUTO_CANCELLED,
          note: 'Gagal mengirim perintah MQTT untuk mematikan outlet',
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
      this.logger.log(`Merestore ${activeTimers.length} timer outlet dari database`);

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
