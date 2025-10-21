import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { PowerstripsService } from './powerstrips.service';

@Controller('powerstrips')
export class PowerstripsController {
  constructor(private readonly powerstripsService: PowerstripsService) {}

  @Get()
  findAll() {
    return this.powerstripsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.powerstripsService.findOne(id);
  }

  @Post()
  create(@Body() body: { name?: string; macAddress?: number }) {
    return this.powerstripsService.create(body);
  }
}
