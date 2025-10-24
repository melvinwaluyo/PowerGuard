import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { TimerModule } from '../timer/timer.module';
import { OutletsController } from './outlets.controller';
import { OutletsService } from './outlets.service';

@Module({
  imports: [MqttModule, TimerModule],
  controllers: [OutletsController],
  providers: [OutletsService],
  exports: [OutletsService], // Export for use in other modules
})
export class OutletsModule {}
