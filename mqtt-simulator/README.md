# PowerGuard MQTT Simulator

This simulator mimics the behavior of the STM32 device by publishing power data to MQTT topics. Use this to test the PowerGuard application before the physical hardware is ready.

## Features

- Publishes realistic power data (voltage, current, power, energy) to MQTT topics
- Listens to control commands (ON/OFF) from the backend
- Simulates multiple outlets simultaneously
- Uses the SAME MQTT topics that the STM32 will use (no code changes needed when switching to real hardware)

## MQTT Topics

### Published Topics (Data from Device)
- `powerguard/{outletId}/data` - Power usage data

Message format:
```json
{
  "current": 0.545,
  "power": 120.50,
  "energy": 0.0234
}
```

### Subscribed Topics (Commands to Device)
- `powerguard/{outletId}/control` - Control commands (ON/OFF)

Message format:
```json
{
  "state": true
}
```

## Installation

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and configure your settings:
   ```
   API_URL=http://localhost:3000
   MQTT_SERVER=broker.emqx.io
   MQTT_PORT=1883
   OUTLET_IDS=1,2,3,4
   PUBLISH_INTERVAL=5000
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Start the simulator:
```bash
npm start
```

For development with auto-restart (Node.js 18+):
```bash
npm run dev
```

## Configuration

### Environment Variables

- `API_URL` - Backend API URL to fetch initial outlet states (default: http://localhost:3000)
- `MQTT_SERVER` - MQTT broker hostname (default: broker.emqx.io)
- `MQTT_PORT` - MQTT broker port (default: 1883)
- `MQTT_USERNAME` - MQTT username (optional, for authenticated brokers)
- `MQTT_PASSWORD` - MQTT password (optional, for authenticated brokers)
- `OUTLET_IDS` - Comma-separated list of outlet IDs to simulate (default: 1,2,3,4)
- `PUBLISH_INTERVAL` - How often to publish data in milliseconds (default: 5000)

## How It Works

This simulator mimics **real STM32 hardware behavior** as closely as possible:

1. **Connection**: Connects to the MQTT broker using the provided credentials
2. **State Initialization**: Fetches current outlet states from backend API to sync with actual database state
   - If backend is unreachable, all outlets default to OFF (safe default)
3. **Subscription**: Subscribes to `powerguard/+/control` to listen for outlet control commands
4. **Data Generation**:
   - **Outlet ON**: Generates realistic power data (100-150W with sinusoidal variation, ~220V, calculated current)
   - **Outlet OFF**: Sends **0W, 0A** (simulates real sensor reading when relay is OFF)
   - Energy: Accumulated only when outlet is ON (stops when OFF)
5. **Publishing**: **Always publishes** data to `powerguard/{outletId}/data` every 5 seconds
   - This matches real STM32 behavior where sensors always report (even if 0)
   - Allows backend to detect device online/offline vs outlet just OFF
   - **Note**: Backend automatically skips storing 0 values (prevents database flooding)

## Testing

Once the simulator is running:

1. It will fetch the current state of all outlets from the backend
2. It will **always publish data** for all outlets:
   - Outlets ON: Real power values (e.g., 125.50W, 0.570A)
   - Outlets OFF: Zero values (0.00W, 0.000A) - **this is normal!**
3. Use your mobile app or backend API to turn outlets ON/OFF
4. The simulator will respond to control commands immediately
5. Check the console output to see:
   - Initial outlet states (🟢 ON / 🔴 OFF)
   - Published data for ALL outlets (0W when OFF, real values when ON)
   - Received control commands (🔧 Outlet X turned ON/OFF)

## Switching to Real Hardware

When your STM32 device is ready:

1. Stop this simulator
2. Configure your STM32 to:
   - Publish to: `powerguard/{outletId}/data`
   - Subscribe to: `powerguard/{outletId}/control`
3. No changes needed in your backend or mobile app!

## Troubleshooting

### Connection Failed
- Verify MQTT broker is running and accessible
- Check MQTT_SERVER and MQTT_PORT are correct
- Verify username/password if authentication is enabled

### Not Receiving Control Commands
- Ensure backend is publishing to the correct topics
- Check MQTT broker logs for message delivery
- Verify outlet IDs match between simulator and backend

### High CPU Usage
- Increase PUBLISH_INTERVAL to reduce publishing frequency
- Reduce the number of simulated outlets

### Seeing 0W for All Outlets
- **This is normal if outlets are OFF!** Real STM32 sensors read 0 when relay is OFF
- The simulator still publishes these 0 values (mimics real hardware)
- Backend logs will show "Skipped storing 0 values" - **this is intentional** to prevent database flooding
- Check outlet states in your mobile app - they should show OFF (red)
- Turn outlets ON via app to see real power values
- If outlets are ON but still showing 0W, check backend MQTT connection

### Outlets Don't Match App State
- Verify `API_URL` points to your backend (use Azure URL if backend is deployed)
- Ensure backend is running and accessible
- Restart simulator to re-fetch outlet states from backend
- If backend is unreachable, simulator defaults all outlets to OFF for safety

## License

MIT
