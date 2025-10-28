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
  @ApiOperation({ summary: 'Get timer status for specific outlet' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'Outlet ID' })
  @ApiResponse({ status: 200, description: 'Current timer status' })
  getStatus(@Param('outletId', ParseIntPipe) outletId: number) {
    return this.timerService.getTimerStatus(outletId);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start timer for outlet' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'Outlet ID' })
  @ApiBody({ type: StartTimerDto })
  @ApiResponse({ status: 201, description: 'Timer started' })
  startTimer(
    @Param('outletId', ParseIntPipe) outletId: number,
    @Body() dto: StartTimerDto,
  ) {
    return this.timerService.startTimer(outletId, dto.durationSeconds);
  }

  @Post('stop')
  @ApiOperation({ summary: 'Stop active timer' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'Outlet ID' })
  @ApiResponse({ status: 200, description: 'Timer stopped' })
  stopTimer(@Param('outletId', ParseIntPipe) outletId: number) {
    return this.timerService.stopTimer(outletId, {
      status: TimerLogStatus.STOPPED,
      note: 'Timer stopped manually',
    });
  }

  @Post('preset')
  @ApiOperation({ summary: 'Update default timer duration without running it' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'Outlet ID' })
  @ApiBody({ type: UpdateTimerPresetDto })
  @ApiResponse({ status: 200, description: 'Timer preset updated' })
  updatePreset(
    @Param('outletId', ParseIntPipe) outletId: number,
    @Body() dto: UpdateTimerPresetDto,
  ) {
    return this.timerService.updateTimerPreset(outletId, dto.durationSeconds);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get timer log history for outlet' })
  @ApiParam({ name: 'outletId', type: 'number', description: 'Outlet ID' })
  @ApiQuery({ name: 'limit', type: 'number', required: false, description: 'Number of logs (default 20)' })
  @ApiResponse({ status: 200, description: 'Returns timer logs' })
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
