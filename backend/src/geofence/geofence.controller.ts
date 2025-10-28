import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { GeofenceService } from './geofence.service';
import type { GeofenceSettingDto } from './geofence.service';
import { GeofenceAutomationService } from './geofence-automation.service';
import { ReportLocationDto } from './dto/report-location.dto';
import { AutoShutdownService } from './auto-shutdown.service';

@ApiTags('geofence')
@Controller('geofence')
export class GeofenceController {
  constructor(
    private readonly geofenceService: GeofenceService,
    private readonly geofenceAutomationService: GeofenceAutomationService,
    private readonly autoShutdownService: AutoShutdownService,
  ) {}

  @Get('powerstrip/:id')
  @ApiOperation({ summary: 'Get geofence settings for a power strip' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiResponse({ status: 200, description: 'Geofence settings retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Geofence settings not found' })
  getByPowerstrip(@Param('id', ParseIntPipe) id: number) {
    return this.geofenceService.getByPowerstrip(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update geofence settings' })
  @ApiBody({
    description: 'Geofence settings data',
    schema: {
      type: 'object',
      properties: {
        powerstripID: { type: 'number', example: 1 },
        isEnabled: { type: 'boolean', example: true },
        latitude: { type: 'number', example: -7.770959 },
        longitude: { type: 'number', example: 110.377571 },
        radius: { type: 'number', example: 1500, description: 'Radius in meters' },
        autoShutdownTime: { type: 'number', example: 900, description: 'Time in seconds' },
      },
      required: ['powerstripID', 'isEnabled'],
    },
  })
  @ApiResponse({ status: 201, description: 'Geofence settings saved successfully' })
  upsert(@Body() data: GeofenceSettingDto) {
    return this.geofenceService.upsert(data);
  }

  @Patch('powerstrip/:id/enabled')
  @ApiOperation({ summary: 'Toggle geofencing on/off for a power strip' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiBody({
    description: 'Enable/disable geofencing',
    schema: {
      type: 'object',
      properties: {
        isEnabled: { type: 'boolean', example: true },
      },
      required: ['isEnabled'],
    },
  })
  @ApiResponse({ status: 200, description: 'Geofencing status updated successfully' })
  updateEnabled(
    @Param('id', ParseIntPipe) id: number,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.geofenceService.updateEnabled(id, isEnabled);
  }

  @Post('powerstrip/:id/report')
  @ApiOperation({ summary: 'Laporkan lokasi terbaru untuk evaluasi geofence' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiBody({ type: ReportLocationDto })
  @ApiResponse({ status: 200, description: 'Status geofence terkini' })
  reportLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ReportLocationDto,
  ) {
    return this.geofenceAutomationService.evaluateLocation(id, payload);
  }

  @Get('powerstrip/:id/auto-shutdown/pending')
  @ApiOperation({ summary: 'Daftar permintaan auto shutdown yang belum diproses' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiResponse({ status: 200, description: 'Daftar permintaan pending' })
  pendingRequests(@Param('id', ParseIntPipe) id: number) {
    return this.autoShutdownService.getPendingRequests(id);
  }

  @Post('auto-shutdown/:requestId/confirm')
  @ApiOperation({ summary: 'Confirm auto-shutdown and turn off outlets' })
  @ApiResponse({ status: 200, description: 'Auto-shutdown confirmed' })
  confirmAutoShutdown(@Param('requestId', ParseIntPipe) requestId: number) {
    return this.autoShutdownService.confirm(requestId);
  }

  @Post('auto-shutdown/:requestId/cancel')
  @ApiOperation({ summary: 'Cancel auto-shutdown, keep outlets on' })
  @ApiResponse({ status: 200, description: 'Auto-shutdown cancelled' })
  cancelAutoShutdown(@Param('requestId', ParseIntPipe) requestId: number) {
    return this.autoShutdownService.cancel(requestId);
  }
}
