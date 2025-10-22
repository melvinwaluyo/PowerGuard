import { Module } from '@nestjs/common';
import { OutletsController } from './outlets.controller';
import { OutletsService } from './outlets.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [OutletsController],
  providers: [OutletsService],
  exports: [OutletsService], // Export for use in other modules
})
export class OutletsModule {}
