import { Module } from '@nestjs/common';
import { PowerstripsController } from './powerstrips.controller';
import { PowerstripsService } from './powerstrips.service';
import { OutletsModule } from '../outlets/outlets.module';

@Module({
  imports: [OutletsModule],
  controllers: [PowerstripsController],
  providers: [PowerstripsService],
})
export class PowerstripsModule {}
