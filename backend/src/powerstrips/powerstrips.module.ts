import { Module } from '@nestjs/common';
import { PowerstripsController } from './powerstrips.controller';
import { PowerstripsService } from './powerstrips.service';

@Module({
  controllers: [PowerstripsController],
  providers: [PowerstripsService],
})
export class PowerstripsModule {}
