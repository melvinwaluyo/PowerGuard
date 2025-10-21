import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

/**
 * MQTT Simulator - Simulates STM32 sending power data
 * Use this to test the app before STM32 is ready
 *
 * To enable: Set ENABLE_MQTT_SIMULATOR=true in .env
 */
@Injectable()
export class MqttSimulatorService implements OnModuleInit {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService.get<string>('ENABLE_MQTT_SIMULATOR') === 'true';

    if (isEnabled) {
      console.log('🧪 MQTT Simulator: ENABLED - Generating mock power data');
      this.startSimulation();
    } else {
      console.log('🧪 MQTT Simulator: DISABLED - Set ENABLE_MQTT_SIMULATOR=true to enable');
    }
  }

  private startSimulation() {
    // Send mock data every 5 seconds
    this.intervalId = setInterval(async () => {
      await this.generateMockData();
    }, 5000);
  }

  private async generateMockData() {
    try {
      // Get all outlets
      const outlets = await this.prisma.outlet.findMany({
        where: { state: true }, // Only simulate for outlets that are ON
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

        // Get previous energy total
        const lastLog = await this.prisma.usageLog.findFirst({
          where: { outletID: outlet.outletID },
          orderBy: { createdAt: 'desc' },
        });

        const totalEnergy = (lastLog?.energy || 0) + energyIncrement;

        // Save to database (simulating MQTT message received)
        await this.prisma.usageLog.create({
          data: {
            outletID: outlet.outletID,
            current: parseFloat(current.toFixed(3)),
            power: parseFloat(power.toFixed(2)),
            energy: parseFloat(totalEnergy.toFixed(4)),
          },
        });

        console.log(`📊 Simulated data for Outlet ${outlet.outletID}: ${power.toFixed(2)}W, ${current.toFixed(3)}A`);
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
