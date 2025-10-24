import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TimerService } from './timer.service';
import { StartTimerDto } from './dto/start-timer.dto';
import { UpdateTimerPresetDto } from './dto/update-timer-preset.dto';
import { TimerLogStatus } from '@prisma/client';

@ApiTags('timer')
@Controller('outlets/:outletId/timer')
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @Get()
  @ApiOperation({ summary: 'Status timer untuk outlet tertentu' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'ID outlet' })
  @ApiResponse({ status: 200, description: 'Status timer terkini' })
  getStatus(@Param('outletId', ParseIntPipe) outletId: number) {
    return this.timerService.getTimerStatus(outletId);
  }

  @Post('start')
  @ApiOperation({ summary: 'Mulai timer untuk outlet' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'ID outlet' })
  @ApiBody({ type: StartTimerDto })
  @ApiResponse({ status: 201, description: 'Timer dimulai' })
  startTimer(
    @Param('outletId', ParseIntPipe) outletId: number,
    @Body() dto: StartTimerDto,
  ) {
    return this.timerService.startTimer(outletId, dto.durationSeconds);
  }

  @Post('stop')
  @ApiOperation({ summary: 'Hentikan timer aktif' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'ID outlet' })
  @ApiResponse({ status: 200, description: 'Timer dihentikan' })
  stopTimer(@Param('outletId', ParseIntPipe) outletId: number) {
    return this.timerService.stopTimer(outletId, {
      status: TimerLogStatus.STOPPED,
      note: 'Timer dihentikan manual',
    });
  }

  @Post('preset')
  @ApiOperation({ summary: 'Perbarui durasi default timer tanpa menjalankannya' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'ID outlet' })
  @ApiBody({ type: UpdateTimerPresetDto })
  @ApiResponse({ status: 200, description: 'Preset timer diperbarui' })
  updatePreset(
    @Param('outletId', ParseIntPipe) outletId: number,
    @Body() dto: UpdateTimerPresetDto,
  ) {
    return this.timerService.updateTimerPreset(outletId, dto.durationSeconds);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Riwayat log timer untuk outlet' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'ID outlet' })
  @ApiQuery({ name: 'limit', type: 'number', required: false, description: 'Jumlah log (default 20)' })
  @ApiResponse({ status: 200, description: 'Mengembalikan log timer' })
  getLogs(
    @Param('outletId', ParseIntPipe) outletId: number,
    @Query('limit') limit?: number,
  ) {
    const rawLimit = limit !== undefined ? Number(limit) : 20;
    const safeLimit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), 100) : 20;
    return this.timerService.getTimerLogs(outletId, safeLimit);
  }
}
