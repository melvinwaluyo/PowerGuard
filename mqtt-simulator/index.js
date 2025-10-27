require('dotenv').config();
const mqtt = require('mqtt');

/**
 * MQTT Simulator - Simulates STM32 sending power data via MQTT
 * Use this to test the app before STM32 is ready
 *
 * This simulator publishes to the SAME MQTT topics that the STM32 will use.
 * When STM32 is ready, just use it instead - NO code changes needed!
 *
 * Topics used (same as STM32):
 * - Publish to: powerguard/{outletId}/data
 * - Subscribe to: powerguard/{outletId}/control
 */

class MqttSimulator {
  constructor() {
    this.client = null;
    this.intervalId = null;
    this.lastEnergy = new Map(); // Track energy per outlet
    this.outlets = []; // Will be loaded from config
  }

  async connect() {
    const server = process.env.MQTT_SERVER || 'localhost';
    const port = process.env.MQTT_PORT || 1883;
    const username = process.env.MQTT_USERNAME || '';
    const password = process.env.MQTT_PASSWORD || '';

    console.log(`🔌 Connecting to MQTT broker at ${server}:${port}...`);

    this.client = mqtt.connect(`mqtt://${server}:${port}`, {
      username,
      password,
    });

    this.client.on('connect', () => {
      console.log('✅ Connected to MQTT broker');
      this.subscribeToControlTopics();
      this.initializeOutlets();
      this.startSimulation();
    });

    this.client.on('error', (error) => {
      console.error('❌ MQTT connection error:', error.message);
    });

    this.client.on('message', (topic, message) => {
      this.handleControlMessage(topic, message);
    });
  }

  /**
   * Initialize outlets configuration
   * You can modify this to match your outlet IDs
   */
  initializeOutlets() {
    // Parse outlet IDs from environment variable (comma-separated)
    // Example: OUTLET_IDS=1,2,3,4
    const outletIds = process.env.OUTLET_IDS || '1,2,3,4';
    this.outlets = outletIds.split(',').map(id => ({
      id: parseInt(id.trim()),
      state: true, // Initially ON
    }));

    // Initialize energy tracking
    this.outlets.forEach(outlet => {
      this.lastEnergy.set(outlet.id, 0);
    });

    console.log(`📍 Initialized ${this.outlets.length} outlets:`, this.outlets.map(o => o.id).join(', '));
  }

  /**
   * Subscribe to control topics to receive ON/OFF commands
   * This simulates STM32 listening for control commands
   */
  subscribeToControlTopics() {
    const topic = 'powerguard/+/control';
    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error('❌ Failed to subscribe to control topics:', err);
      } else {
        console.log(`👂 Subscribed to ${topic} (listening for outlet control commands)`);
      }
    });
  }

  /**
   * Handle control messages (ON/OFF commands)
   */
  handleControlMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const parts = topic.split('/');

      if (parts[0] === 'powerguard' && parts[2] === 'control') {
        const outletId = parseInt(parts[1]);
        const outlet = this.outlets.find(o => o.id === outletId);

        if (outlet) {
          outlet.state = data.state;
          console.log(`🔧 Outlet ${outletId} turned ${data.state ? 'ON' : 'OFF'}`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing control message:', error.message);
    }
  }

  /**
   * Start publishing simulated power data
   */
  startSimulation() {
    const interval = parseInt(process.env.PUBLISH_INTERVAL || '5000');
    console.log(`🚀 Starting simulation (publishing every ${interval}ms)...`);
    console.log('');

    // Publish immediately, then at intervals
    this.publishMockData();
    this.intervalId = setInterval(() => {
      this.publishMockData();
    }, interval);
  }

  /**
   * Generate and publish mock power data via MQTT (simulating STM32)
   */
  publishMockData() {
    const timestamp = new Date().toLocaleTimeString();

    this.outlets.forEach(outlet => {
      // Only publish data for outlets that are ON
      if (!outlet.state) {
        return;
      }

      // Generate realistic power data
      const baseLoad = 100 + Math.random() * 50; // 100-150W base load
      const variation = Math.sin(Date.now() / 10000) * 20; // Sinusoidal variation

      const power = Math.max(0, baseLoad + variation); // Watts
      const voltage = 220 + (Math.random() - 0.5) * 5; // 220V ± 2.5V
      const current = power / voltage; // Amps (P = V × I)

      // Calculate energy (kWh) - approximate incremental energy
      const interval = parseInt(process.env.PUBLISH_INTERVAL || '5000');
      const energyIncrement = (power / 1000) * (interval / 3600000); // Convert ms to hours
      const totalEnergy = this.lastEnergy.get(outlet.id) + energyIncrement;

      // Update tracked energy
      this.lastEnergy.set(outlet.id, totalEnergy);

      // Publish to MQTT topic (same as STM32 will use)
      const topic = `powerguard/${outlet.id}/data`;
      const message = JSON.stringify({
        current: parseFloat(current.toFixed(3)),
        power: parseFloat(power.toFixed(2)),
        energy: parseFloat(totalEnergy.toFixed(4)),
      });

      this.client.publish(topic, message, (err) => {
        if (err) {
          console.error(`❌ Failed to publish to ${topic}:`, err.message);
        }
      });

      console.log(
        `[${timestamp}] 📊 Outlet ${outlet.id}: ${power.toFixed(2)}W, ${current.toFixed(3)}A, ${totalEnergy.toFixed(4)}kWh`
      );
    });

    console.log('');
  }

  /**
   * Stop the simulator
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.client) {
      this.client.end();
      console.log('🛑 Simulator stopped');
    }
  }
}

// Run the simulator
const simulator = new MqttSimulator();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down simulator...');
  simulator.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down simulator...');
  simulator.stop();
  process.exit(0);
});

// Start the simulator
simulator.connect();
