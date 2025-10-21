import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { OutletsService } from './outlets.service';
import { MqttService } from '../mqtt/mqtt.service';

@ApiTags('outlets')
@Controller('outlets')
export class OutletsController {
  constructor(
    private readonly outletsService: OutletsService,
    private readonly mqttService: MqttService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all outlets' })
  @ApiResponse({ status: 200, description: 'Returns all outlets with their power strips and latest usage data' })
  findAll() {
    return this.outletsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific outlet by ID' })
  @ApiParam({ name: 'id', type: 'number', description: 'Outlet ID' })
  @ApiResponse({ status: 200, description: 'Returns outlet details with usage history' })
  @ApiResponse({ status: 404, description: 'Outlet not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.findOne(id);
  }

  @Patch(':id/state')
  @ApiOperation({ summary: 'Turn outlet on/off (sends MQTT command to STM32)' })
  @ApiParam({ name: 'id', type: 'number', description: 'Outlet ID' })
  @ApiBody({
    description: 'Outlet state',
    schema: {
      type: 'object',
      properties: {
        state: { type: 'boolean', example: true, description: 'true = ON, false = OFF' },
      },
      required: ['state'],
    },
  })
  @ApiResponse({ status: 200, description: 'Outlet state updated and MQTT command sent' })
  async updateState(
    @Param('id', ParseIntPipe) id: number,
    @Body('state') state: boolean,
  ) {
    // Update database and send MQTT command to STM32
    await this.mqttService.controlOutlet(id, state);
    return { success: true, outletId: id, state };
  }

  @Get(':id/usage-logs')
  @ApiOperation({ summary: 'Get power usage history for an outlet' })
  @ApiParam({ name: 'id', type: 'number', description: 'Outlet ID' })
  @ApiQuery({ name: 'limit', type: 'number', required: false, description: 'Number of records to return (default: 100)' })
  @ApiResponse({ status: 200, description: 'Returns usage logs (current, power, energy) ordered by time' })
  getUsageLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', ParseIntPipe) limit: number = 100,
  ) {
    return this.outletsService.getUsageLogs(id, limit);
  }

  @Get(':id/recent-usage')
  @ApiOperation({ summary: 'Get the most recent power usage reading' })
  @ApiParam({ name: 'id', type: 'number', description: 'Outlet ID' })
  @ApiResponse({ status: 200, description: 'Returns the latest usage data point' })
  getRecentUsage(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.getRecentUsage(id);
  }

  @Patch(':id/name')
  @ApiOperation({ summary: 'Update outlet name' })
  @ApiParam({ name: 'id', type: 'number', description: 'Outlet ID' })
  @ApiBody({
    description: 'New outlet name',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Living Room Lamp' },
      },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 200, description: 'Outlet name updated successfully' })
  updateName(
    @Param('id', ParseIntPipe) id: number,
    @Body('name') name: string,
  ) {
    return this.outletsService.updateName(id, name);
  }
}
