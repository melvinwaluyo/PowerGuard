import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import type { GeofenceSettingDto } from './geofence.service';

@Controller('geofence')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Get('powerstrip/:id')
  getByPowerstrip(@Param('id', ParseIntPipe) id: number) {
    return this.geofenceService.getByPowerstrip(id);
  }

  @Post()
  upsert(@Body() data: GeofenceSettingDto) {
    return this.geofenceService.upsert(data);
  }

  @Patch('powerstrip/:id/enabled')
  updateEnabled(
    @Param('id', ParseIntPipe) id: number,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.geofenceService.updateEnabled(id, isEnabled);
  }
}
