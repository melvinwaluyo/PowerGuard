import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.outlet.findMany({
      include: {
        powerStrip: true,
        usageLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.outlet.findUnique({
      where: { outletID: id },
      include: {
        powerStrip: true,
        usageLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async updateState(id: number, state: boolean) {
    return this.prisma.outlet.update({
      where: { outletID: id },
      data: { state },
    });
  }

  async getUsageLogs(outletId: number, limit: number = 100) {
    return this.prisma.usageLog.findMany({
      where: { outletID: outletId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRecentUsage(outletId: number) {
    return this.prisma.usageLog.findFirst({
      where: { outletID: outletId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
