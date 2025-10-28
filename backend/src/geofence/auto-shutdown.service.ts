import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AutoShutdownStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TimerService } from '../timer/timer.service';

@Injectable()
export class AutoShutdownService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timerService: TimerService,
  ) {}

  async getPendingRequests(powerstripID: number) {
    return this.prisma.autoShutdownRequest.findMany({
      where: {
        powerstripID,
        status: AutoShutdownStatus.PENDING,
      },
      orderBy: { initiatedAt: 'desc' },
      include: {
        outlet: true,
      },
    });
  }

  async confirm(requestId: number) {
    const request = await this.prisma.autoShutdownRequest.findUnique({
      where: { requestID: requestId },
    });

    if (!request) {
      throw new NotFoundException('Auto shutdown request not found');
    }

    if (request.status !== AutoShutdownStatus.PENDING) {
      throw new BadRequestException('Auto shutdown request already resolved');
    }

    const pendingRequests = await this.prisma.autoShutdownRequest.findMany({
      where: {
        powerstripID: request.powerstripID,
        status: AutoShutdownStatus.PENDING,
      },
      select: {
        requestID: true,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.autoShutdownRequest.update({
        where: { requestID: requestId },
        data: {
          status: AutoShutdownStatus.CONFIRMED,
          note: 'Disetujui pengguna',
        },
      });

      if (pendingRequests.length > 0) {
        await tx.autoShutdownRequest.updateMany({
          where: {
            powerstripID: request.powerstripID,
            status: AutoShutdownStatus.PENDING,
            requestID: {
              not: requestId,
            },
          },
          data: {
            status: AutoShutdownStatus.CONFIRMED,
            note: 'Disetujui bersamaan melalui auto shutdown batch',
          },
        });
      }
    });

    await this.timerService.fulfillGeofenceAutoShutdown(request.outletID, request.powerstripID);

    return { success: true };
  }

  async cancel(requestId: number) {
    const request = await this.prisma.autoShutdownRequest.findUnique({
      where: { requestID: requestId },
    });

    if (!request) {
      throw new NotFoundException('Auto shutdown request not found');
    }

    if (request.status !== AutoShutdownStatus.PENDING) {
      throw new BadRequestException('Auto shutdown request already resolved');
    }

    await this.prisma.autoShutdownRequest.update({
      where: { requestID: requestId },
      data: {
        status: AutoShutdownStatus.CANCELLED,
        note: 'Cancelled by user',
      },
    });

    await this.prisma.notificationLog.create({
      data: {
        outletID: request.outletID,
        message: 'Geofence auto-shutdown cancelled. Outlets remain on.',
      },
    });

    return { success: true };
  }
}
