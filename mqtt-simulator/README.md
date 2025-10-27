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

2. Edit `.env` and configure your MQTT broker settings:
   ```
   MQTT_SERVER=localhost
   MQTT_PORT=1883
   MQTT_USERNAME=your_username
   MQTT_PASSWORD=your_password
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

- `MQTT_SERVER` - MQTT broker hostname (default: localhost)
- `MQTT_PORT` - MQTT broker port (default: 1883)
- `MQTT_USERNAME` - MQTT username (optional)
- `MQTT_PASSWORD` - MQTT password (optional)
- `OUTLET_IDS` - Comma-separated list of outlet IDs to simulate (default: 1,2,3,4)
- `PUBLISH_INTERVAL` - How often to publish data in milliseconds (default: 5000)

## How It Works

1. **Connection**: Connects to the MQTT broker using the provided credentials
2. **Subscription**: Subscribes to `powerguard/+/control` to listen for outlet control commands
3. **Data Generation**: Generates realistic power data for each outlet that is ON:
   - Base load: 100-150W with sinusoidal variation
   - Voltage: ~220V with small variations
   - Current: Calculated from P = V × I
   - Energy: Accumulated over time (in kWh)
4. **Publishing**: Publishes data to `powerguard/{outletId}/data` at the configured interval

## Testing

Once the simulator is running:

1. It will immediately start publishing data for all configured outlets
2. Use your backend API to send control commands (turn outlets ON/OFF)
3. The simulator will respond to control commands and adjust its behavior
4. Check the console output to see published data and received commands

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

## License

MIT
