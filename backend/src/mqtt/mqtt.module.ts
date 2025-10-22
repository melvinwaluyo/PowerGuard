import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttSimulatorService } from './mqtt-simulator.service';

@Module({
  providers: [MqttService, MqttSimulatorService],
  exports: [MqttService],
})
export class MqttModule {}
