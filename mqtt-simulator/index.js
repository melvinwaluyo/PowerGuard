require('dotenv').config();
const mqtt = require('mqtt');

/**
 * MQTT Simulator - Simulates STM32 behavior including timers
 * Use this to test the app before STM32 is ready
 *
 * This simulator publishes to the SAME MQTT topics that the STM32 will use.
 * When STM32 is ready, just use it instead - NO code changes needed!
 *
 * Topics used (same as STM32):
 * - Publish to: powerguard/{outletId}/data
 * - Publish to: powerguard/{outletId}/timer/status
 * - Subscribe to: powerguard/{outletId}/control
 * - Subscribe to: powerguard/{outletId}/timer/start
 * - Subscribe to: powerguard/{outletId}/timer/stop
 */

class MqttSimulator {
  constructor() {
    this.client = null;
    this.intervalId = null;
    this.lastEnergy = new Map(); // Track energy per outlet
    this.outlets = []; // Will be loaded from config
    this.timers = new Map(); // Track active timers: outletId -> { timeout, statusInterval, endsAt, duration, source }
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

    this.client.on('connect', async () => {
      console.log('✅ Connected to MQTT broker');
      this.subscribeToControlTopics();
      await this.initializeOutlets();
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
   * Initialize outlets configuration by fetching current state from backend
   * You can modify this to match your outlet IDs
   */
  async initializeOutlets() {
    // Parse outlet IDs from environment variable (comma-separated)
    // Example: OUTLET_IDS=1,2,3,4
    const outletIds = process.env.OUTLET_IDS || '1,2,3,4';
    const apiUrl = process.env.API_URL || 'http://localhost:3000';

    console.log(`🔍 Fetching outlet states from ${apiUrl}/outlets...`);

    try {
      // Fetch current outlet states from backend
      const response = await fetch(`${apiUrl}/outlets`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const outletsData = await response.json();
      const outletIdsArray = outletIds.split(',').map(id => parseInt(id.trim()));

      // Initialize outlets with actual state from backend
      this.outlets = outletIdsArray.map(id => {
        const backendOutlet = outletsData.find(o => o.outletID === id);
        return {
          id: id,
          state: backendOutlet ? backendOutlet.state : false, // Use actual state or default to OFF
        };
      });

      console.log(`✅ Fetched ${this.outlets.length} outlet states from backend`);
    } catch (error) {
      console.warn(`⚠️  Could not fetch outlet states from backend: ${error.message}`);
      console.log(`📍 Initializing outlets as OFF by default...`);

      // Fallback: Initialize all outlets as OFF if backend is unreachable
      this.outlets = outletIds.split(',').map(id => ({
        id: parseInt(id.trim()),
        state: false, // Default to OFF
      }));
    }

    // Initialize energy tracking
    this.outlets.forEach(outlet => {
      this.lastEnergy.set(outlet.id, 0);
    });

    // Show outlet states
    this.outlets.forEach(outlet => {
      console.log(`  Outlet ${outlet.id}: ${outlet.state ? '🟢 ON' : '🔴 OFF'}`);
    });
  }

  /**
   * Subscribe to control and timer topics
   * This simulates STM32 listening for commands
   */
  subscribeToControlTopics() {
    const topics = [
      'powerguard/+/control',
      'powerguard/+/timer/start',
      'powerguard/+/timer/stop'
    ];

    topics.forEach(topic => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`👂 Subscribed to ${topic}`);
        }
      });
    });
  }

  /**
   * Handle control and timer messages
   */
  handleControlMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const parts = topic.split('/');

      if (parts[0] !== 'powerguard') return;

      const outletId = parseInt(parts[1]);

      // Handle outlet control (ON/OFF)
      if (parts[2] === 'control') {
        const outlet = this.outlets.find(o => o.id === outletId);
        if (outlet) {
          outlet.state = data.state;
          console.log(`🔧 Outlet ${outletId} turned ${data.state ? 'ON' : 'OFF'}`);

          // If turned off and timer is active, stop the timer
          if (!data.state && this.timers.has(outletId)) {
            this.stopTimer(outletId, 'power_off');
          }
        }
      }

      // Handle timer start
      if (parts[2] === 'timer' && parts[3] === 'start') {
        this.startTimer(outletId, data.durationSeconds, data.source || 'MANUAL');
      }

      // Handle timer stop
      if (parts[2] === 'timer' && parts[3] === 'stop') {
        this.stopTimer(outletId, data.reason || 'cancelled');
      }
    } catch (error) {
      console.error('❌ Error processing message:', error.message);
    }
  }

  /**
   * Start a timer for an outlet (simulates STM32 timer)
   */
  startTimer(outletId, durationSeconds, source) {
    console.log(`⏱️  Starting timer for outlet ${outletId}: ${durationSeconds}s (source: ${source})`);

    // Cancel existing timer if any
    if (this.timers.has(outletId)) {
      this.stopTimer(outletId, 'replaced');
    }

    const endsAt = Date.now() + (durationSeconds * 1000);

    // Set timeout to turn off outlet when timer completes
    const timeout = setTimeout(() => {
      this.completeTimer(outletId);
    }, durationSeconds * 1000);

    // Publish status updates every 10 seconds
    const statusInterval = setInterval(() => {
      this.publishTimerStatus(outletId);
    }, 1000);

    // Store timer info
    this.timers.set(outletId, {
      timeout,
      statusInterval,
      endsAt,
      duration: durationSeconds,
      source
    });

    // Publish initial status immediately
    this.publishTimerStatus(outletId);
  }

  /**
   * Stop a timer for an outlet
   */
  stopTimer(outletId, reason) {
    const timer = this.timers.get(outletId);
    if (!timer) return;

    console.log(`⏹️  Stopping timer for outlet ${outletId} (reason: ${reason})`);

    // Clear timeout and interval
    clearTimeout(timer.timeout);
    clearInterval(timer.statusInterval);
    this.timers.delete(outletId);

    // Publish final status (inactive)
    this.publishTimerStatus(outletId);
  }

  /**
   * Complete a timer (turn off outlet)
   * This simulates STM32 behavior: when timer expires, physically turn off relay
   */
  completeTimer(outletId) {
    console.log(`✅ Timer completed for outlet ${outletId} - turning OFF`);

    const timer = this.timers.get(outletId);
    if (!timer) return;

    // Save timer info before clearing (needed for final status message)
    const completedTimerInfo = {
      duration: timer.duration,
      source: timer.source
    };

    // Clear the timer
    clearInterval(timer.statusInterval);
    this.timers.delete(outletId);

    // Turn off the outlet (simulating STM32 turning off physical relay)
    const outlet = this.outlets.find(o => o.id === outletId);
    if (outlet) {
      outlet.state = false;
    }

    // Publish final timer status with completion info
    // Backend will detect completion from this and update database + create notification
    this.publishTimerStatus(outletId, completedTimerInfo);

    console.log(`💡 Outlet ${outletId} is now OFF (timer completed)`);
  }

  /**
   * Publish timer status to MQTT (simulates STM32 status updates)
   * @param {number} outletId - Outlet ID
   * @param {object} completedTimerInfo - Optional timer info for completion message (duration, source)
   */
  publishTimerStatus(outletId, completedTimerInfo = null) {
    const timer = this.timers.get(outletId);
    const topic = `powerguard/${outletId}/timer/status`;

    let message;
    if (timer) {
      // Timer is active - send current status
      const remainingSeconds = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
      message = JSON.stringify({
        isActive: true,
        remainingSeconds,
        durationSeconds: timer.duration,
        source: timer.source
      });
      console.log(`⏱️  [${timer.source}] Timer status: outlet ${outletId} - ${remainingSeconds}s remaining (duration: ${timer.duration}s)`);
    } else if (completedTimerInfo) {
      // Timer just completed - send final status with completion info
      message = JSON.stringify({
        isActive: false,
        remainingSeconds: 0,
        durationSeconds: completedTimerInfo.duration, // IMPORTANT: Keep duration for backend detection
        source: completedTimerInfo.source
      });
      console.log(`✅ [${completedTimerInfo.source}] Timer completed: outlet ${outletId} (duration: ${completedTimerInfo.duration}s)`);
    } else {
      // No timer and no completion info - timer is just inactive
      message = JSON.stringify({
        isActive: false,
        remainingSeconds: 0,
        durationSeconds: 0,
        source: null
      });
    }

    this.client.publish(topic, message, (err) => {
      if (err) {
        console.error(`❌ Failed to publish timer status to ${topic}:`, err.message);
      }
    });
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
   * Real STM32 behavior: Always publish, but send 0 values when outlet is OFF
   */
  publishMockData() {
    const timestamp = new Date().toLocaleTimeString();

    this.outlets.forEach(outlet => {
      let current, power, totalEnergy;

      if (outlet.state) {
        // Outlet is ON - Generate realistic power data
        const baseLoad = 100 + Math.random() * 50; // 100-150W base load
        const variation = Math.sin(Date.now() / 10000) * 20; // Sinusoidal variation

        power = Math.max(0, baseLoad + variation); // Watts
        const voltage = 220 + (Math.random() - 0.5) * 5; // 220V ± 2.5V
        current = power / voltage; // Amps (P = V × I)

        // Calculate energy (kWh) - approximate incremental energy
        const interval = parseInt(process.env.PUBLISH_INTERVAL || '5000');
        const energyIncrement = (power / 1000) * (interval / 3600000); // Convert ms to hours
        totalEnergy = this.lastEnergy.get(outlet.id) + energyIncrement;

        // Update tracked energy
        this.lastEnergy.set(outlet.id, totalEnergy);
      } else {
        // Outlet is OFF - Sensor reads 0 (this is real STM32 behavior!)
        current = 0;
        power = 0;
        totalEnergy = this.lastEnergy.get(outlet.id); // Energy doesn't increase when OFF
      }

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

    // Clean up all active timers
    for (const [outletId, timer] of this.timers.entries()) {
      clearTimeout(timer.timeout);
      clearInterval(timer.statusInterval);
    }
    this.timers.clear();

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
