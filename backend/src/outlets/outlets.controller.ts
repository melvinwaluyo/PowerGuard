import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { OutletsService } from './outlets.service';
import { MqttService } from '../mqtt/mqtt.service';

@Controller('outlets')
export class OutletsController {
  constructor(
    private readonly outletsService: OutletsService,
    private readonly mqttService: MqttService,
  ) {}

  @Get()
  findAll() {
    return this.outletsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.findOne(id);
  }

  @Patch(':id/state')
  async updateState(
    @Param('id', ParseIntPipe) id: number,
    @Body('state') state: boolean,
  ) {
    // Update database and send MQTT command to STM32
    await this.mqttService.controlOutlet(id, state);
    return { success: true, outletId: id, state };
  }

  @Get(':id/usage-logs')
  getUsageLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', ParseIntPipe) limit: number = 100,
  ) {
    return this.outletsService.getUsageLogs(id, limit);
  }

  @Get(':id/recent-usage')
  getRecentUsage(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.getRecentUsage(id);
  }
}
