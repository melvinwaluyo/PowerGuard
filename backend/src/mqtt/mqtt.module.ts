import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [FcmModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
