import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { MqttService } from './mqtt.service';

/**
 * MQTT Simulator - Simulates STM32 sending power data via MQTT
 * Use this to test the app before STM32 is ready
 *
 * This simulator publishes to the SAME MQTT topics that the STM32 will use.
 * When STM32 is ready, just use it instead - NO code changes needed!
 *
 * To enable: Set ENABLE_MQTT_SIMULATOR=true in .env
 *
 * Topics used (same as STM32):
 * - Publish to: powerguard/{outletId}/data
 * - Subscribe to: powerguard/{outletId}/control
 */
@Injectable()
export class MqttSimulatorService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout | null = null;
  private lastEnergy: Map<number, number> = new Map(); // Track energy per outlet

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private mqttService: MqttService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService.get<string>('ENABLE_MQTT_SIMULATOR') === 'true';

    if (isEnabled) {
      console.log('🧪 MQTT Simulator: ENABLED');
      console.log('   → Publishing to MQTT topics (same as STM32 will use)');
      console.log('   → Simulating power data every 5 seconds');

      // Wait a bit for MQTT service to connect
      setTimeout(() => {
        this.initializeEnergyTracking();
        this.subscribeToControlTopics();
        this.startSimulation();
      }, 2000);
    } else {
      console.log('🧪 MQTT Simulator: DISABLED - Set ENABLE_MQTT_SIMULATOR=true to enable');
    }
  }

  async onModuleDestroy() {
    this.stop();
  }

  /**
   * Initialize energy tracking from the last log entry
   */
  private async initializeEnergyTracking() {
    try {
      const outlets = await this.prisma.outlet.findMany();

      for (const outlet of outlets) {
        const lastLog = await this.prisma.usageLog.findFirst({
          where: { outletID: outlet.outletID },
          orderBy: { createdAt: 'desc' },
        });

        this.lastEnergy.set(outlet.outletID, lastLog?.energy || 0);
      }
    } catch (error) {
      console.error('Error initializing energy tracking:', error);
    }
  }

  /**
   * Subscribe to control topics (simulating STM32 listening for commands)
   * The STM32 should subscribe to these topics to receive ON/OFF commands
   */
  private subscribeToControlTopics() {
    // Note: In the real implementation, MqttService already handles this
    // This is here to document the expected STM32 behavior
    console.log('🧪 [Simulator] Would subscribe to: powerguard/+/control');
    console.log('   → STM32 should subscribe to this topic to receive outlet state changes');
    console.log('   → Message format: {"state": true/false}');
  }

  private startSimulation() {
    // Send mock data every 5 seconds
    this.intervalId = setInterval(async () => {
      await this.generateMockData();
    }, 5000);
  }

  /**
   * Generate and publish mock power data via MQTT (simulating STM32)
   * This publishes to the SAME topics the STM32 will use
   */
  private async generateMockData() {
    try {
      // Get all outlets that are ON
      const outlets = await this.prisma.outlet.findMany({
        where: { state: true },
      });

      for (const outlet of outlets) {
        // Generate realistic power data
        const baseLoad = 100 + Math.random() * 50; // 100-150W base load
        const variation = Math.sin(Date.now() / 10000) * 20; // Sinusoidal variation

        const power = Math.max(0, baseLoad + variation); // Watts
        const voltage = 220 + (Math.random() - 0.5) * 5; // 220V ± 2.5V
        const current = power / voltage; // Amps (P = V × I)

        // Calculate energy (kWh) - approximate incremental energy
        const energyIncrement = (power / 1000) * (5 / 3600); // 5 seconds in hours
        const totalEnergy = (this.lastEnergy.get(outlet.outletID) || 0) + energyIncrement;

        // Update tracked energy
        this.lastEnergy.set(outlet.outletID, totalEnergy);

        // Publish to MQTT topic (same as STM32 will use)
        const topic = `powerguard/${outlet.outletID}/data`;
        const message = JSON.stringify({
          current: parseFloat(current.toFixed(3)),
          power: parseFloat(power.toFixed(2)),
          energy: parseFloat(totalEnergy.toFixed(4)),
        });

        this.mqttService.publish(topic, message);

        console.log(
          `📊 [Simulator] Published to ${topic}: ${power.toFixed(2)}W, ${current.toFixed(3)}A, ${totalEnergy.toFixed(4)}kWh`,
        );
      }
    } catch (error) {
      console.error('Error generating mock data:', error);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🧪 MQTT Simulator: STOPPED');
    }
  }
}
