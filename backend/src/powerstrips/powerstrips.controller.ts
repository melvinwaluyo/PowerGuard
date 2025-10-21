import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { PowerstripsService } from './powerstrips.service';

@ApiTags('powerstrips')
@Controller('powerstrips')
export class PowerstripsController {
  constructor(private readonly powerstripsService: PowerstripsService) {}

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
}
