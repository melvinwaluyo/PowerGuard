import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AutoShutdownStatus, GeofenceZone, TimerLogStatus, TimerSource } from '@prisma/client';
import { TimerService } from '../timer/timer.service';

export interface GeofenceLocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeofenceEvaluationResult {
  zone: GeofenceZone;
  distanceMeters: number;
  countdownIsActive: boolean;
  countdownEndsAt: string | null;
  autoShutdownSeconds: number | null;
  triggeredOutlets: number[];
  pendingRequest: {
    requestId: number;
    outletId: number;
    initiatedAt: string;
    expiresAt: string | null;
  } | null;
}

const DEFAULT_AUTO_SHUTDOWN = 900; // 15 minutes fallback

@Injectable()
export class GeofenceAutomationService {
  private readonly logger = new Logger(GeofenceAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly timerService: TimerService,
  ) {}

  async evaluateLocation(
    powerstripID: number,
    payload: GeofenceLocationPayload,
  ): Promise<GeofenceEvaluationResult> {
    const settings = await this.prisma.geofenceSetting.findFirst({
      where: { powerstripID },
    });

    if (!settings || !settings.isEnabled || settings.latitude == null || settings.longitude == null) {
      return {
        zone: GeofenceZone.INSIDE,
        distanceMeters: 0,
        countdownIsActive: false,
        countdownEndsAt: null,
        autoShutdownSeconds: null,
        triggeredOutlets: [],
        pendingRequest: null,
      };
    }

    const pendingRequest = await this.prisma.autoShutdownRequest.findFirst({
      where: {
        powerstripID,
        status: AutoShutdownStatus.PENDING,
      },
      orderBy: { initiatedAt: 'desc' },
    });
    const serializedPending = pendingRequest
      ? {
          requestId: pendingRequest.requestID,
          outletId: pendingRequest.outletID,
          initiatedAt: pendingRequest.initiatedAt.toISOString(),
          expiresAt: pendingRequest.expiresAt ? pendingRequest.expiresAt.toISOString() : null,
        }
      : null;

    const distanceMeters = this.calculateDistanceMeters(
      payload.latitude,
      payload.longitude,
      settings.latitude,
      settings.longitude,
    );

    const radius = settings.radius ?? 1500;
    const zone = distanceMeters > radius ? GeofenceZone.OUTSIDE : GeofenceZone.INSIDE;
    const autoShutdownSeconds = settings.autoShutdownTime ?? DEFAULT_AUTO_SHUTDOWN;

    const previousZone = settings.lastStatus ?? GeofenceZone.INSIDE;
    const countdownIsActive = Boolean(settings.countdownIsActive);

    const triggeredOutlets: number[] = [];

    if (zone === GeofenceZone.OUTSIDE) {
      if (pendingRequest) {
        if (settings.lastStatus !== GeofenceZone.OUTSIDE) {
          await this.prisma.geofenceSetting.update({
            where: { settingID: settings.settingID },
            data: {
              lastStatus: GeofenceZone.OUTSIDE,
              countdownIsActive: false,
              countdownStartedAt: null,
              countdownEndsAt: null,
            },
          });
        }
        return {
          zone,
          distanceMeters,
          countdownIsActive: false,
          countdownEndsAt: null,
          autoShutdownSeconds,
          triggeredOutlets,
          pendingRequest: serializedPending,
        };
      }

      if (!countdownIsActive || previousZone !== GeofenceZone.OUTSIDE) {
        const now = new Date();
        const countdownEndsAtDate = new Date(now.getTime() + autoShutdownSeconds * 1000);
        const countdownEndsAtIso = countdownEndsAtDate.toISOString();
        const outlets = await this.prisma.outlet.findMany({
          where: {
            powerstripID,
            state: true,
          },
          select: {
            outletID: true,
            timerIsActive: true,
            timerSource: true,
          },
        });

        // If no outlets are ON, don't start the countdown
        if (outlets.length === 0) {
          await this.prisma.geofenceSetting.update({
            where: { settingID: settings.settingID },
            data: {
              lastStatus: GeofenceZone.OUTSIDE,
              countdownIsActive: false,
              countdownStartedAt: null,
              countdownEndsAt: null,
            },
          });

          return {
            zone,
            distanceMeters,
            countdownIsActive: false,
            countdownEndsAt: null,
            autoShutdownSeconds,
            triggeredOutlets,
            pendingRequest: serializedPending,
          };
        }

        for (const outlet of outlets) {
          try {
            await this.timerService.startTimer(outlet.outletID, autoShutdownSeconds, {
              source: TimerSource.GEOFENCE,
              note: 'Timer geofence dimulai (keluar radius)',
              allowReplace: outlet.timerSource === TimerSource.GEOFENCE,
            });
            triggeredOutlets.push(outlet.outletID);
          } catch (error) {
            this.logger.warn(
              `Gagal memulai timer geofence untuk outlet ${outlet.outletID}: ${(error as Error).message}`,
            );
          }
        }

        await this.prisma.geofenceSetting.update({
          where: { settingID: settings.settingID },
          data: {
            lastStatus: GeofenceZone.OUTSIDE,
            countdownIsActive: true,
            countdownStartedAt: new Date(),
            countdownEndsAt: countdownEndsAtDate,
          },
        });

        return {
          zone,
          distanceMeters,
          countdownIsActive: true,
          countdownEndsAt: countdownEndsAtIso,
          autoShutdownSeconds,
          triggeredOutlets,
          pendingRequest: serializedPending,
        };
      }

      // Already outside with active countdown
      // Check if there are still any outlets ON with geofence timer
      const activeOutlets = await this.prisma.outlet.findMany({
        where: {
          powerstripID,
          state: true,
          timerIsActive: true,
          timerSource: TimerSource.GEOFENCE,
        },
        select: { outletID: true },
      });

      // If no outlets are ON anymore, stop the countdown
      if (activeOutlets.length === 0) {
        await this.prisma.geofenceSetting.update({
          where: { settingID: settings.settingID },
          data: {
            lastStatus: GeofenceZone.OUTSIDE,
            countdownIsActive: false,
            countdownStartedAt: null,
            countdownEndsAt: null,
          },
        });

        return {
          zone,
          distanceMeters,
          countdownIsActive: false,
          countdownEndsAt: null,
          autoShutdownSeconds,
          triggeredOutlets,
          pendingRequest: serializedPending,
        };
      }

      if (previousZone !== GeofenceZone.OUTSIDE) {
        await this.prisma.geofenceSetting.update({
          where: { settingID: settings.settingID },
          data: { lastStatus: GeofenceZone.OUTSIDE },
        });
      }
      return {
        zone,
        distanceMeters,
        countdownIsActive: true,
        countdownEndsAt: settings.countdownEndsAt ? settings.countdownEndsAt.toISOString() : null,
        autoShutdownSeconds,
        triggeredOutlets,
        pendingRequest: serializedPending,
      };
    }

    // Zone inside
    if (countdownIsActive) {
      const outlets = await this.prisma.outlet.findMany({
        where: {
          powerstripID,
          timerIsActive: true,
          timerSource: TimerSource.GEOFENCE,
        },
        select: { outletID: true },
      });

      for (const outlet of outlets) {
        try {
          await this.timerService.stopTimer(outlet.outletID, {
            status: TimerLogStatus.AUTO_CANCELLED,
            note: 'Geofence timer cancelled (returned to safe radius)',
            expectedSource: TimerSource.GEOFENCE,
            logWhenInactive: false,
          });
        } catch (error) {
          this.logger.warn(
            `Gagal menghentikan timer geofence untuk outlet ${outlet.outletID}: ${(error as Error).message}`,
          );
        }
      }

      await this.prisma.geofenceSetting.update({
        where: { settingID: settings.settingID },
        data: {
          lastStatus: GeofenceZone.INSIDE,
          countdownIsActive: false,
          countdownStartedAt: null,
          countdownEndsAt: null,
        },
      });

      if (outlets.length) {
        await this.createNotification(
          outlets[0].outletID,
          'Auto-shutdown cancelled: You returned to safe location.',
        );
      }
    } else if (previousZone !== GeofenceZone.INSIDE) {
      await this.prisma.geofenceSetting.update({
        where: { settingID: settings.settingID },
        data: {
          lastStatus: GeofenceZone.INSIDE,
        },
      });
    }

    return {
      zone,
      distanceMeters,
      countdownIsActive: false,
      countdownEndsAt: null,
      autoShutdownSeconds,
      triggeredOutlets,
      pendingRequest: pendingRequest
        ? serializedPending
        : null,
    };
  }

  private calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371000; // meters

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  private async createNotification(outletId: number, message: string) {
    await this.prisma.notificationLog.create({
      data: {
        outletID: outletId,
        message,
      },
    });
  }
}
