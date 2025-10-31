import { Controller, Post, Body, Logger } from '@nestjs/common';
import { FcmService } from './fcm.service';

@Controller('fcm')
export class FcmController {
  private readonly logger = new Logger(FcmController.name);

  constructor(private readonly fcmService: FcmService) {}

  @Post('register')
  async register(
    @Body() body: { token: string; platform: string; deviceId: string; powerstripId?: number },
  ) {
    this.logger.log(`Registering FCM token for device: ${body.deviceId}`);
    return this.fcmService.registerToken(
      body.deviceId,
      body.token,
      body.platform,
      body.powerstripId || 1, // Default to powerstrip 1
    );
  }

  @Post('unregister')
  async unregister(@Body() body: { token: string }) {
    this.logger.log(`Unregistering FCM token`);
    return this.fcmService.unregisterToken(body.token);
  }

  @Post('test')
  async testNotification(
    @Body() body: { token: string; title: string; body: string; isCritical?: boolean },
  ) {
    this.logger.log(`Sending test notification to token: ${body.token.substring(0, 20)}...`);
    return this.fcmService.sendNotification(
      body.token,
      body.title,
      body.body,
      { type: 'test' },
      body.isCritical || false,
    );
  }
}
