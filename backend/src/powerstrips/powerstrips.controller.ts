import { Controller, Get, Post, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PowerstripsService } from './powerstrips.service';
import { OutletsService } from '../outlets/outlets.service';

@ApiTags('powerstrips')
@Controller('powerstrips')
export class PowerstripsController {
  constructor(
    private readonly powerstripsService: PowerstripsService,
    private readonly outletsService: OutletsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all power strips' })
  @ApiResponse({ status: 200, description: 'Returns all power strips with their outlets and geofence settings' })
  findAll() {
    return this.powerstripsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific power strip by ID' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiResponse({ status: 200, description: 'Returns power strip details with outlets' })
  @ApiResponse({ status: 404, description: 'Power strip not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.powerstripsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new power strip' })
  @ApiBody({
    description: 'Power strip data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Living Room Power Strip' },
        macAddress: { type: 'number', example: 123456789 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Power strip created successfully' })
  create(@Body() body: { name?: string; macAddress?: number }) {
    return this.powerstripsService.create(body);
  }

  // Usage Aggregation Endpoints for Reporting Charts

  @Get(':id/usage/hourly')
  @ApiOperation({ summary: 'Get hourly usage for the last 24 hours (for Day tab)' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiQuery({ name: 'all', type: 'boolean', required: false, description: 'Fetch all historical data instead of just last 24 hours' })
  @ApiResponse({
    status: 200,
    description: 'Returns hourly aggregated energy usage',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hour: { type: 'string', format: 'date-time' },
          total_energy_kwh: { type: 'number' },
          avg_power_w: { type: 'number' },
        },
      },
    },
  })
  getHourlyUsage(
    @Param('id', ParseIntPipe) id: number,
    @Query('all') all?: boolean,
  ) {
    return this.outletsService.getHourlyUsage(id, all === true);
  }

  @Get(':id/usage/daily')
  @ApiOperation({ summary: 'Get daily usage for a specific month (for Month tab)' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiQuery({ name: 'year', type: 'number', required: false, description: 'Year (defaults to current year)' })
  @ApiQuery({ name: 'month', type: 'number', required: false, description: 'Month 1-12 (defaults to current month)' })
  @ApiQuery({ name: 'all', type: 'boolean', required: false, description: 'Fetch all historical data instead of specific month' })
  @ApiResponse({
    status: 200,
    description: 'Returns daily aggregated energy usage for the specified month',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string', format: 'date-time' },
          total_energy_kwh: { type: 'number' },
          avg_power_w: { type: 'number' },
        },
      },
    },
  })
  getDailyUsage(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('all') all?: boolean,
  ) {
    if (all === true) {
      return this.outletsService.getDailyUsage(id, null, null);
    }
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1; // 1-12
    return this.outletsService.getDailyUsage(id, targetYear, targetMonth);
  }

  @Get(':id/usage/monthly')
  @ApiOperation({ summary: 'Get monthly usage for a specific year (for Year tab)' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiQuery({ name: 'year', type: 'number', required: false, description: 'Year (defaults to current year)' })
  @ApiQuery({ name: 'all', type: 'boolean', required: false, description: 'Fetch all historical data instead of specific year' })
  @ApiResponse({
    status: 200,
    description: 'Returns monthly aggregated energy usage for the specified year',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          month: { type: 'string', format: 'date-time' },
          total_energy_kwh: { type: 'number' },
          avg_power_w: { type: 'number' },
        },
      },
    },
  })
  getMonthlyUsage(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year?: number,
    @Query('all') all?: boolean,
  ) {
    if (all === true) {
      return this.outletsService.getMonthlyUsage(id, null);
    }
    const targetYear = year ?? new Date().getFullYear();
    return this.outletsService.getMonthlyUsage(id, targetYear);
  }

  @Get(':id/usage/past30days')
  @ApiOperation({ summary: 'Get daily usage for past 30 days (for Past 30 Days stat card)' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns daily aggregated energy usage for the past 30 days',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string', format: 'date-time' },
          total_energy_kwh: { type: 'number' },
        },
      },
    },
  })
  getPast30DaysUsage(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.getPast30DaysUsage(id);
  }

  @Get(':id/usage/today')
  @ApiOperation({ summary: 'Get total usage for today (for Today stat card)' })
  @ApiParam({ name: 'id', type: 'number', description: 'Power strip ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns total energy usage for today',
    schema: {
      type: 'number',
      example: 5.42,
    },
  })
  getTodayUsage(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.getTodayUsage(id);
  }
}
