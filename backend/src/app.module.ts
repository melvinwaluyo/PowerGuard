import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { OutletsModule } from './outlets/outlets.module';
import { PowerstripsModule } from './powerstrips/powerstrips.module';
import { GeofenceModule } from './geofence/geofence.module';
import { TimerModule } from './timer/timer.module';
import { FcmModule } from './fcm/fcm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    MqttModule,
    OutletsModule,
    PowerstripsModule,
    GeofenceModule,
    TimerModule,
    FcmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
