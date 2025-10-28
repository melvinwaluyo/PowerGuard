import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: MqttClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const server = this.configService.get<string>('MQTT_SERVER');
    const port = this.configService.get<number>('MQTT_PORT');
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const mqttOptions: any = {};

    // Only add credentials if they are provided
    if (username) {
      mqttOptions.username = username;
    }
    if (password) {
      mqttOptions.password = password;
    }

    this.client = mqtt.connect(`mqtt://${server}:${port}`, mqttOptions);

    this.client.on('connect', () => {
      console.log('Connected to EMQX MQTT broker');
      // Subscribe to power data topics
      this.client.subscribe('powerguard/+/data', (err) => {
        if (err) {
          console.error('Failed to subscribe to topics:', err);
        } else {
          console.log('Subscribed to powerguard/+/data');
        }
      });
    });

    this.client.on('message', async (topic, message) => {
      await this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      console.error('MQTT connection error:', error);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      this.client.end();
      console.log('Disconnected from EMQX MQTT broker');
    }
  }

  private async handleMessage(topic: string, message: Buffer) {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received MQTT message:', { topic, data });

      // Example: powerguard/{outlet_id}/data
      const parts = topic.split('/');
      if (parts[0] === 'powerguard' && parts[2] === 'data') {
        const outletId = parseInt(parts[1]);

        // Skip storing if all values are 0 or null (outlet is OFF)
        // This prevents database flooding with useless zero entries
        const power = data.power || 0;
        const current = data.current || 0;

        if (power === 0 && current === 0) {
          console.log(`Skipped storing 0 values for outlet ${outletId} (outlet is OFF)`);
          return;
        }

        // Store usage data in database (only meaningful data)
        await this.prisma.usageLog.create({
          data: {
            outletID: outletId,
            current: data.current || null,
            power: data.power || null,
            energy: data.energy || null,
          },
        });

        console.log(`Stored usage data for outlet ${outletId}: ${power}W, ${current}A`);
      }
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }

  // Method to publish messages to MQTT
  publish(topic: string, message: string): void {
    if (this.client && this.client.connected) {
      this.client.publish(topic, message, (err) => {
        if (err) {
          console.error('Failed to publish message:', err);
        }
      });
    }
  }

  // Method to control outlet state
  async controlOutlet(outletId: number, state: boolean): Promise<void> {
    const topic = `powerguard/${outletId}/control`;
    const message = JSON.stringify({ state });
    this.publish(topic, message);

    // Update database
    await this.prisma.outlet.update({
      where: { outletID: outletId },
      data: { state },
    });
  }
}
