import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  AutoShutdownStatus,
  GeofenceZone,
  TimerLogStatus,
  TimerSource,
} from '@prisma/client';
import { TimerService } from '../timer/timer.service';
import { FcmService } from '../fcm/fcm.service';

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
  remainingSeconds: number;
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
    private readonly fcmService: FcmService,
  ) {}

  /**
   * Calculate remaining seconds until countdown ends
   */
  private calculateRemainingSeconds(
    countdownEndsAt: Date | string | null,
  ): number {
    if (!countdownEndsAt) return 0;
    const endsAtTime =
      countdownEndsAt instanceof Date
        ? countdownEndsAt.getTime()
        : new Date(countdownEndsAt).getTime();
    return Math.max(0, Math.round((endsAtTime - Date.now()) / 1000));
  }

  async evaluateLocation(
    powerstripID: number,
    payload: GeofenceLocationPayload,
  ): Promise<GeofenceEvaluationResult> {
    const settings = await this.prisma.geofenceSetting.findFirst({
      where: { powerstripID },
    });

    if (
      !settings ||
      !settings.isEnabled ||
      settings.latitude == null ||
      settings.longitude == null
    ) {
      return {
        zone: GeofenceZone.INSIDE,
        distanceMeters: 0,
        countdownIsActive: false,
        countdownEndsAt: null,
        remainingSeconds: 0,
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
          expiresAt: pendingRequest.expiresAt
            ? pendingRequest.expiresAt.toISOString()
            : null,
        }
      : null;

    const distanceMeters = this.calculateDistanceMeters(
      payload.latitude,
      payload.longitude,
      settings.latitude,
      settings.longitude,
    );

    const radius = settings.radius ?? 1500;
    const zone =
      distanceMeters > radius ? GeofenceZone.OUTSIDE : GeofenceZone.INSIDE;
    const autoShutdownSeconds =
      settings.autoShutdownTime ?? DEFAULT_AUTO_SHUTDOWN;

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
          remainingSeconds: 0,
          autoShutdownSeconds,
          triggeredOutlets,
          pendingRequest: serializedPending,
        };
      }

      if (!countdownIsActive || previousZone !== GeofenceZone.OUTSIDE) {
        const now = new Date();
        const countdownEndsAtDate = new Date(
          now.getTime() + autoShutdownSeconds * 1000,
        );
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
            remainingSeconds: 0,
            autoShutdownSeconds,
            triggeredOutlets,
            pendingRequest: serializedPending,
          };
        }

        // Use atomic update as a lock - only proceed if countdown is not already active
        // This prevents race conditions when multiple location updates come in simultaneously
        const updateResult = await this.prisma.geofenceSetting.updateMany({
          where: {
            settingID: settings.settingID,
            countdownIsActive: false, // Only update if countdown is not already active
          },
          data: {
            lastStatus: GeofenceZone.OUTSIDE,
            countdownIsActive: true,
            countdownStartedAt: new Date(),
            countdownEndsAt: countdownEndsAtDate,
          },
        });

        // If update count is 0, another request already activated the countdown
        if (updateResult.count === 0) {
          this.logger.log(
            `Skipping geofence countdown activation for powerstrip ${powerstripID}: already active (race condition prevented)`,
          );
          // Return current state
          return {
            zone,
            distanceMeters,
            countdownIsActive: true,
            countdownEndsAt: countdownEndsAtIso,
            remainingSeconds:
              this.calculateRemainingSeconds(countdownEndsAtDate),
            autoShutdownSeconds,
            triggeredOutlets: [],
            pendingRequest: serializedPending,
          };
        }

        // We successfully acquired the lock, proceed with timer activation
        for (const outlet of outlets) {
          try {
            // Double-check outlet is still ON before starting timer (prevents race conditions)
            const currentState = await this.prisma.outlet.findUnique({
              where: { outletID: outlet.outletID },
              select: { state: true },
            });

            if (!currentState?.state) {
              this.logger.warn(
                `Skipping geofence timer for outlet ${outlet.outletID}: outlet is OFF`,
              );
              continue;
            }

            await this.timerService.startTimer(
              outlet.outletID,
              autoShutdownSeconds,
              {
                source: TimerSource.GEOFENCE,
                note: 'Geofence timer started (left radius)',
                allowReplace: outlet.timerSource === TimerSource.GEOFENCE,
              },
            );
            triggeredOutlets.push(outlet.outletID);
          } catch (error) {
            this.logger.warn(
              `Failed to start geofence timer for outlet ${outlet.outletID}: ${(error as Error).message}`,
            );
          }
        }

        // Send FCM notification based on scenario
        // Note: This only executes once due to the atomic update lock above
        if (triggeredOutlets.length > 0) {
          const tokens =
            await this.fcmService.getTokensForPowerstrip(powerstripID);
          if (tokens.length > 0) {
            const minutes = Math.floor(autoShutdownSeconds / 60);
            const seconds = autoShutdownSeconds % 60;
            const timerText =
              minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

            // Differentiate between leaving zone vs turning on while outside
            const justLeftZone = previousZone !== GeofenceZone.OUTSIDE;
            const isCritical = justLeftZone; // Critical only when user forgot and left

            let title: string;
            let message: string;
            let notificationType: string;

            if (justLeftZone) {
              // Scenario 1: User left home with outlets ON (unintentional/forgetful)
              title = 'PowerGuard CRITICAL ALERT';
              message = `You left home with ${triggeredOutlets.length} outlet${triggeredOutlets.length > 1 ? 's' : ''} still ON! Auto-shutdown in ${timerText}.`;
              notificationType = 'geofence_exit';
            } else {
              // Scenario 2: User turned on outlets while already outside (intentional)
              title = 'PowerGuard Alert';
              message = `You turned on ${triggeredOutlets.length} outlet${triggeredOutlets.length > 1 ? 's' : ''} while away from home. Auto-shutdown in ${timerText}.`;
              notificationType = 'outlet_turned_on_outside';
            }

            await this.fcmService.sendToMultipleDevices(
              tokens,
              title,
              message,
              {
                type: notificationType,
                activeOutletCount: triggeredOutlets.length.toString(),
                powerstripId: powerstripID.toString(),
              },
              isCritical,
            );
            this.logger.log(
              `[FCM] Sent ${isCritical ? 'CRITICAL' : 'standard'} geofence notification (${notificationType}) to ${tokens.length} device(s)`,
            );

            // Log the notification for audit trail
            await this.prisma.notificationLog.create({
              data: {
                outletID: triggeredOutlets[0],
                message,
              },
            });
          }
        }

        return {
          zone,
          distanceMeters,
          countdownIsActive: true,
          countdownEndsAt: countdownEndsAtIso,
          remainingSeconds: this.calculateRemainingSeconds(countdownEndsAtDate),
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
          remainingSeconds: 0,
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
        countdownEndsAt: settings.countdownEndsAt
          ? settings.countdownEndsAt.toISOString()
          : null,
        remainingSeconds: this.calculateRemainingSeconds(
          settings.countdownEndsAt,
        ),
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
            `Failed to stop geofence timer for outlet ${outlet.outletID}: ${(error as Error).message}`,
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
        const message =
          'Auto-shutdown cancelled: You returned to safe location.';
        await this.createNotification(outlets[0].outletID, message);

        // Send FCM notification for cancelled geofence countdown
        const tokens =
          await this.fcmService.getTokensForPowerstrip(powerstripID);
        if (tokens.length > 0) {
          await this.fcmService.sendToMultipleDevices(
            tokens,
            'Auto-Shutdown Cancelled',
            message,
            {
              type: 'geofence_cancelled',
              powerstripId: powerstripID.toString(),
            },
            false, // Not critical
          );
          this.logger.log(
            `[FCM] Sent geofence cancellation notification to ${tokens.length} device(s)`,
          );
        }
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
      remainingSeconds: 0,
      autoShutdownSeconds,
      triggeredOutlets,
      pendingRequest: pendingRequest ? serializedPending : null,
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
    // Check for duplicate notifications in the last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const recentNotification = await this.prisma.notificationLog.findFirst({
      where: {
        outletID: outletId,
        message,
        createdAt: {
          gte: thirtySecondsAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (recentNotification) {
      const timeSince = recentNotification.createdAt
        ? Math.round(
            (Date.now() - recentNotification.createdAt.getTime()) / 1000,
          )
        : 0;

      this.logger.log(
        `Skipping duplicate notification for outlet ${outletId}: "${message}" (last sent ${timeSince}s ago)`,
      );
      return;
    }

    await this.prisma.notificationLog.create({
      data: {
        outletID: outletId,
        message,
      },
    });

    this.logger.log(
      `Created notification for outlet ${outletId}: "${message}"`,
    );
  }
}
