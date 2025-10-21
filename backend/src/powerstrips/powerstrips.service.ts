import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PowerstripsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.powerStrip.findMany({
      include: {
        outlets: {
          include: {
            usageLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        geofenceSettings: true,
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.powerStrip.findUnique({
      where: { powerstripID: id },
      include: {
        outlets: {
          include: {
            usageLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        geofenceSettings: true,
      },
    });
  }

  async create(data: { name?: string; macAddress?: number }) {
    return this.prisma.powerStrip.create({
      data,
    });
  }
}
