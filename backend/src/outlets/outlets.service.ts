import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.outlet.findMany({
      orderBy: [
        { index: 'asc' },
        { outletID: 'asc' },
      ],
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

  async updateName(id: number, name: string) {
    return this.prisma.outlet.update({
      where: { outletID: id },
      data: { name },
    });
  }

  // Usage Aggregation Methods for Charts

  /**
   * Get hourly usage for the last 24 hours
   * Used for Day tab in reporting
   */
  async getHourlyUsage(powerstripID: number) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.prisma.$queryRaw<
      Array<{ hour: Date; total_energy_kwh: number; avg_power_w: number }>
    >`
      SELECT
        DATE_TRUNC('hour', "createdat") as hour,
        COALESCE(SUM(energy), 0) as total_energy_kwh,
        COALESCE(AVG(power), 0) as avg_power_w
      FROM usagelog ul
      JOIN outlet o ON ul.outletid = o.outletid
      WHERE o.powerstripid = ${powerstripID}
        AND ul.createdat >= ${twentyFourHoursAgo}
      GROUP BY DATE_TRUNC('hour', "createdat")
      ORDER BY hour ASC
    `;

    return result;
  }

  /**
   * Get daily usage for a specific month
   * Used for Month tab in reporting
   */
  async getDailyUsage(powerstripID: number, year: number, month: number) {
    const result = await this.prisma.$queryRaw<
      Array<{ day: Date; total_energy_kwh: number; avg_power_w: number }>
    >`
      SELECT
        DATE_TRUNC('day', "createdat") as day,
        COALESCE(SUM(energy), 0) as total_energy_kwh,
        COALESCE(AVG(power), 0) as avg_power_w
      FROM usagelog ul
      JOIN outlet o ON ul.outletid = o.outletid
      WHERE o.powerstripid = ${powerstripID}
        AND EXTRACT(YEAR FROM "createdat") = ${year}
        AND EXTRACT(MONTH FROM "createdat") = ${month}
      GROUP BY DATE_TRUNC('day', "createdat")
      ORDER BY day ASC
    `;

    return result;
  }

  /**
   * Get monthly usage for a specific year
   * Used for Year tab in reporting
   */
  async getMonthlyUsage(powerstripID: number, year: number) {
    const result = await this.prisma.$queryRaw<
      Array<{ month: Date; total_energy_kwh: number; avg_power_w: number }>
    >`
      SELECT
        DATE_TRUNC('month', "createdat") as month,
        COALESCE(SUM(energy), 0) as total_energy_kwh,
        COALESCE(AVG(power), 0) as avg_power_w
      FROM usagelog ul
      JOIN outlet o ON ul.outletid = o.outletid
      WHERE o.powerstripid = ${powerstripID}
        AND EXTRACT(YEAR FROM "createdat") = ${year}
      GROUP BY DATE_TRUNC('month', "createdat")
      ORDER BY month ASC
    `;

    return result;
  }

  /**
   * Get daily usage for the past 30 days
   * Used for Past 30 Days stat card
   */
  async getPast30DaysUsage(powerstripID: number) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$queryRaw<
      Array<{ day: Date; total_energy_kwh: number }>
    >`
      SELECT
        DATE_TRUNC('day', "createdat") as day,
        COALESCE(SUM(energy), 0) as total_energy_kwh
      FROM usagelog ul
      JOIN outlet o ON ul.outletid = o.outletid
      WHERE o.powerstripid = ${powerstripID}
        AND ul.createdat >= ${thirtyDaysAgo}
      GROUP BY DATE_TRUNC('day', "createdat")
      ORDER BY day ASC
    `;

    return result;
  }

  /**
   * Get total usage for today (all hours so far)
   * Used for Today stat card
   */
  async getTodayUsage(powerstripID: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.$queryRaw<
      Array<{ total_energy_kwh: number }>
    >`
      SELECT
        COALESCE(SUM(energy), 0) as total_energy_kwh
      FROM usagelog ul
      JOIN outlet o ON ul.outletid = o.outletid
      WHERE o.powerstripid = ${powerstripID}
        AND ul.createdat >= ${today}
    `;

    return result[0]?.total_energy_kwh || 0;
  }

  /**
   * Clear all usage log data (for development/testing)
   * WARNING: This will delete ALL usage data from the database
   */
  async clearAllUsageData() {
    await this.prisma.$executeRaw`TRUNCATE TABLE usagelog RESTART IDENTITY CASCADE`;
    return { message: 'All usage data cleared successfully' };
  }
}
