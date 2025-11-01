import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private isInitialized = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Check if Firebase Admin is already initialized
      if (admin.apps.length > 0) {
        this.isInitialized = true;
        this.logger.log('Firebase Admin already initialized');
        return;
      }

      // Check if credentials are provided
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn(
          'Firebase credentials not provided. FCM notifications will be disabled. ' +
            'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env',
        );
        return;
      }

      // Initialize Firebase Admin SDK
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });

      this.isInitialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  /**
   * Register FCM token for a device
   */
  async registerToken(
    deviceId: string,
    token: string,
    platform: string,
    powerstripId: number = 1,
  ) {
    try {
      // Store in database
      await this.prisma.fcmToken.upsert({
        where: { deviceId },
        create: {
          deviceId,
          fcmToken: token,
          platform,
          powerstripID: powerstripId,
        },
        update: {
          fcmToken: token,
          platform,
          powerstripID: powerstripId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Registered FCM token for device ${deviceId} (${platform}) on powerstrip ${powerstripId}`,
      );

      return { success: true, message: 'Token registered' };
    } catch (error) {
      this.logger.error('Failed to register FCM token:', error);
      throw error;
    }
  }

  /**
   * Unregister FCM token
   */
  async unregisterToken(token: string) {
    try {
      await this.prisma.fcmToken.deleteMany({
        where: { fcmToken: token },
      });

      this.logger.log(`Unregistered FCM token: ${token.substring(0, 20)}...`);

      return { success: true, message: 'Token unregistered' };
    } catch (error) {
      this.logger.error('Failed to unregister FCM token:', error);
      throw error;
    }
  }

  /**
   * Send notification to a single device
   */
  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    isCritical: boolean = false,
    customChannelId?: string,
  ): Promise<string | null> {
    if (!this.isInitialized) {
      this.logger.warn('Firebase not initialized. Skipping notification.');
      return null;
    }

    try {
      const channelId =
        customChannelId ||
        (isCritical ? 'critical-alerts-v3' : 'geofence-alerts-v3');

      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          isCritical: isCritical.toString(),
        },
        android: {
          priority: 'high', // Always use high priority to ensure delivery when app is closed
          notification: {
            channelId,
            sound: isCritical ? 'critical.wav' : 'normal.wav',
            priority: isCritical ? 'max' : 'high',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10', // High priority for immediate delivery
          },
          payload: {
            aps: {
              sound: isCritical ? 'critical.wav' : 'normal.wav',
              contentAvailable: true,
              alert: {
                title,
                body,
              },
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`FCM notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Error sending FCM notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    isCritical: boolean = false,
    customChannelId?: string,
  ): Promise<admin.messaging.BatchResponse | null> {
    if (!this.isInitialized) {
      this.logger.warn('Firebase not initialized. Skipping notification.');
      return null;
    }

    if (tokens.length === 0) {
      this.logger.warn('No tokens provided for batch notification');
      return null;
    }

    try {
      const channelId =
        customChannelId ||
        (isCritical ? 'critical-alerts-v3' : 'geofence-alerts-v3');

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          isCritical: isCritical.toString(),
        },
        android: {
          priority: 'high', // Always use high priority to ensure delivery when app is closed
          notification: {
            channelId,
            sound: isCritical ? 'critical.wav' : 'normal.wav',
            priority: isCritical ? 'max' : 'high',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10', // High priority for immediate delivery
          },
          payload: {
            aps: {
              sound: isCritical ? 'critical.wav' : 'normal.wav',
              contentAvailable: true,
              alert: {
                title,
                body,
              },
            },
          },
        },
      };

      this.logger.log(
        `[FCM] Sending multicast message - Title: "${title}", Body: "${body}", Channel: "${channelId}", Data: ${JSON.stringify(data)}, Tokens: ${tokens.length}`,
      );

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `FCM batch notification sent: ${response.successCount}/${tokens.length} succeeded`,
      );

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.warn(
              `Failed to send to token ${tokens[idx]}: ${resp.error}`,
            );
          }
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Error sending FCM batch notification:', error);
      throw error;
    }
  }

  /**
   * Get all FCM tokens for a powerstrip (deduplicated)
   */
  async getTokensForPowerstrip(powerstripId: number): Promise<string[]> {
    try {
      const tokens = await this.prisma.fcmToken.findMany({
        where: { powerstripID: powerstripId },
        select: { fcmToken: true },
      });

      // Deduplicate tokens (in case there are duplicates in DB)
      const uniqueTokens = [...new Set(tokens.map((t) => t.fcmToken))];

      if (uniqueTokens.length < tokens.length) {
        this.logger.warn(
          `Found ${tokens.length - uniqueTokens.length} duplicate FCM tokens for powerstrip ${powerstripId}`,
        );
      }

      return uniqueTokens;
    } catch (error) {
      this.logger.error(
        `Failed to get tokens for powerstrip ${powerstripId}:`,
        error,
      );
      return [];
    }
  }
}
