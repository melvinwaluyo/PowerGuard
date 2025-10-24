import { Module } from '@nestjs/common';
import { TimerService } from './timer.service';
import { TimerController } from './timer.controller';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  providers: [TimerService],
  controllers: [TimerController],
  exports: [TimerService],
})
export class TimerModule {}
