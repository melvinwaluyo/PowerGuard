import { Module } from '@nestjs/common';
import { GeofenceController } from './geofence.controller';
import { GeofenceService } from './geofence.service';
import { GeofenceAutomationService } from './geofence-automation.service';
import { AutoShutdownService } from './auto-shutdown.service';
import { TimerModule } from '../timer/timer.module';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [TimerModule, FcmModule],
  controllers: [GeofenceController],
  providers: [GeofenceService, GeofenceAutomationService, AutoShutdownService],
  exports: [GeofenceService, GeofenceAutomationService, AutoShutdownService],
})
export class GeofenceModule {}
