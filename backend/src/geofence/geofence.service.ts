import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GeofenceZone } from '@prisma/client';

export interface GeofenceSettingDto {
  powerstripID: number;
  isEnabled: boolean;
  latitude?: number;
  longitude?: number;
  radius?: number;
  autoShutdownTime?: number; // in seconds
}

@Injectable()
export class GeofenceService {
  constructor(private prisma: PrismaService) {}

  async getByPowerstrip(powerstripId: number) {
    return this.prisma.geofenceSetting.findFirst({
      where: { powerstripID: powerstripId },
    });
  }

  async upsert(data: GeofenceSettingDto) {
    // Try to find existing setting
    const existing = await this.prisma.geofenceSetting.findFirst({
      where: { powerstripID: data.powerstripID },
    });

    if (existing) {
      // Update existing
      return this.prisma.geofenceSetting.update({
        where: { settingID: existing.settingID },
        data: {
          isEnabled: data.isEnabled,
          latitude: data.latitude,
          longitude: data.longitude,
          radius: data.radius,
          autoShutdownTime: data.autoShutdownTime,
          ...(data.isEnabled === false
            ? {
                countdownIsActive: false,
                countdownStartedAt: null,
                countdownEndsAt: null,
                lastStatus: GeofenceZone.INSIDE,
              }
            : {}),
        },
      });
    } else {
      // Ensure powerstrip exists, create if needed
      await this.ensurePowerstripExists(data.powerstripID);

      // Create new
      return this.prisma.geofenceSetting.create({
        data: {
          powerstripID: data.powerstripID,
          isEnabled: data.isEnabled,
          latitude: data.latitude,
          longitude: data.longitude,
          radius: data.radius,
          autoShutdownTime: data.autoShutdownTime,
          lastStatus: GeofenceZone.INSIDE,
          countdownIsActive: false,
        },
      });
    }
  }

  async updateEnabled(powerstripId: number, isEnabled: boolean) {
    const existing = await this.prisma.geofenceSetting.findFirst({
      where: { powerstripID: powerstripId },
    });

    if (existing) {
      return this.prisma.geofenceSetting.update({
        where: { settingID: existing.settingID },
        data: {
          isEnabled,
          ...(isEnabled
            ? { lastStatus: existing.lastStatus ?? GeofenceZone.INSIDE }
            : {
                countdownIsActive: false,
                countdownStartedAt: null,
                countdownEndsAt: null,
                lastStatus: GeofenceZone.INSIDE,
              }),
        },
      });
    } else {
      // Ensure powerstrip exists, create if needed
      await this.ensurePowerstripExists(powerstripId);

      // Create with default values
      return this.prisma.geofenceSetting.create({
        data: {
          powerstripID: powerstripId,
          isEnabled,
          radius: 1500,
          autoShutdownTime: 900, // 15 minutes default
          lastStatus: GeofenceZone.INSIDE,
          countdownIsActive: false,
        },
      });
    }
  }

  private async ensurePowerstripExists(powerstripId: number) {
    const powerstrip = await this.prisma.powerStrip.findUnique({
      where: { powerstripID: powerstripId },
    });

    if (!powerstrip) {
      // Create default powerstrip
      await this.prisma.powerStrip.create({
        data: {
          powerstripID: powerstripId,
          name: 'Default Power Strip',
        },
      });
    }
  }
}
