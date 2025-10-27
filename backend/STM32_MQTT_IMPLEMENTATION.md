# STM32 MQTT Implementation Guide

This document describes the exact MQTT topics and message formats your STM32 should use. The backend simulator already uses these same topics, so when your STM32 is ready, you can swap it in with **NO code changes needed**.

## MQTT Broker Connection

**Broker**: Public EMQX
**Protocol**: MQTT
**Port**: 1883
**Server**: `broker.emqx.io` (get from .env)
**Authentication**: Not required for public broker (Username & Password optional)

### Connection Settings
```c
// Example connection settings
mqtt_server = "broker.emqx.io"
mqtt_port = 1883
mqtt_username = ""  // Optional for public broker
mqtt_password = ""  // Optional for public broker
protocol = MQTT
```

## Topic Structure

The system uses a simple topic hierarchy:

```
powerguard/{outletId}/{action}
```

- `{outletId}`: The outlet number (1, 2, 3, 4, etc.)
- `{action}`: Either `data` (for sending measurements) or `control` (for receiving commands)

## Topics the STM32 Must Publish To

### 1. Power Data Topic

**Topic Pattern**: `powerguard/{outletId}/data`

**Examples**:
- `powerguard/1/data` - For outlet 1
- `powerguard/2/data` - For outlet 2
- `powerguard/3/data` - For outlet 3
- `powerguard/4/data` - For outlet 4

**Message Format**: JSON
```json
{
  "current": 0.682,
  "power": 150.04,
  "energy": 0.1234
}
```

**Field Descriptions**:
| Field | Type | Unit | Description | Example |
|-------|------|------|-------------|---------|
| `current` | float (3 decimals) | Amperes (A) | Current draw | 0.682 |
| `power` | float (2 decimals) | Watts (W) | Instantaneous power | 150.04 |
| `energy` | float (4 decimals) | Kilowatt-hours (kWh) | Cumulative energy | 0.1234 |

**Publishing Frequency**: Every 5 seconds (recommended)

**Example C Code**:
```c
void publishPowerData(int outletId, float current, float power, float energy) {
    char topic[50];
    char message[200];

    // Build topic
    sprintf(topic, "powerguard/%d/data", outletId);

    // Build JSON message
    sprintf(message, "{\"current\":%.3f,\"power\":%.2f,\"energy\":%.4f}",
            current, power, energy);

    // Publish to MQTT broker
    mqtt_publish(topic, message, QOS_0, false);
}
```

## Topics the STM32 Must Subscribe To

### 2. Control Topic

**Topic Pattern**: `powerguard/{outletId}/control`

**Examples**:
- `powerguard/1/control` - For outlet 1
- `powerguard/2/control` - For outlet 2
- `powerguard/3/control` - For outlet 3
- `powerguard/4/control` - For outlet 4

**Alternative**: Subscribe to all outlets at once:
- `powerguard/+/control` (+ is a wildcard for any outlet ID)

**Message Format**: JSON
```json
{
  "state": true
}
```

**Field Descriptions**:
| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `state` | boolean | `true` or `false` | `true` = Turn ON, `false` = Turn OFF |

**Example C Code**:
```c
void subscribeToControlTopics() {
    // Option 1: Subscribe to all outlets at once
    mqtt_subscribe("powerguard/+/control", QOS_0);

    // Option 2: Subscribe to specific outlets
    // mqtt_subscribe("powerguard/1/control", QOS_0);
    // mqtt_subscribe("powerguard/2/control", QOS_0);
    // ... etc
}

void onMessageReceived(char* topic, char* payload) {
    // Parse topic to get outlet ID
    int outletId;
    sscanf(topic, "powerguard/%d/control", &outletId);

    // Parse JSON payload
    // {"state": true} or {"state": false}
    bool state = parseStateFromJson(payload);

    // Control the physical outlet
    setOutletState(outletId, state);

    printf("Outlet %d turned %s\n", outletId, state ? "ON" : "OFF");
}
```

## Complete STM32 Implementation Checklist

### Initial Setup
- [ ] Connect to Public EMQX MQTT broker (port 1883)
- [ ] Use broker address from environment variables
- [ ] Authentication is optional for public broker

### Subscribe to Control Topics
- [ ] Subscribe to `powerguard/+/control` on startup
- [ ] Implement message handler to parse JSON `{"state": true/false}`
- [ ] Control physical outlets based on received state

### Publish Power Data
- [ ] Measure current, power, and energy for each outlet
- [ ] Calculate cumulative energy (kWh) for each outlet
- [ ] Publish to `powerguard/{outletId}/data` every 5 seconds
- [ ] Format message as JSON: `{"current": X.XXX, "power": XX.XX, "energy": X.XXXX}`
- [ ] Only publish data for outlets that are ON (optional optimization)

### Error Handling
- [ ] Handle MQTT connection loss and reconnect automatically
- [ ] Re-subscribe to control topics after reconnection
- [ ] Handle invalid JSON messages gracefully
- [ ] Log errors for debugging

## Testing Before STM32 Integration

A standalone MQTT simulator is available in the `mqtt-simulator/` directory. To test:

1. Navigate to the simulator directory:
   ```bash
   cd mqtt-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the simulator (copy .env.example to .env and update settings):
   ```bash
   cp .env.example .env
   ```

4. Start the simulator:
   ```bash
   npm start
   ```

5. You should see:
   ```
   ✅ Connected to MQTT broker
   📍 Initialized 4 outlets: 1, 2, 3, 4
   👂 Subscribed to powerguard/+/control
   🚀 Starting simulation...
   📊 Outlet 1: 125.34W, 0.570A, 0.0174kWh
   ```

6. Test outlet control via API:
   ```bash
   curl -X PATCH http://localhost:3000/outlets/1/state \
     -H "Content-Type: application/json" \
     -d '{"state": true}'
   ```

## Switching from Simulator to STM32

When your STM32 is ready:

1. Stop the MQTT simulator (Ctrl+C)

2. Connect STM32 to the same MQTT broker

3. **That's it!** No code changes needed in the backend.

The backend will automatically:
- Receive data from STM32 via `powerguard/+/data` subscription
- Store data in the database
- Send control commands to STM32 via `powerguard/{id}/control` publications

## Message Flow Diagram

```
┌─────────────┐                    ┌──────────────┐                    ┌──────────────┐
│   STM32     │                    │ MQTT Broker  │                    │   Backend    │
│  (Hardware) │                    │ (Public EMQX)│                    │  (NestJS)    │
└─────────────┘                    └──────────────┘                    └──────────────┘
       │                                   │                                   │
       │  Subscribe: powerguard/+/control  │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │  Subscribe: powerguard/+/data     │
       │                                   │<──────────────────────────────────│
       │                                   │                                   │
       │  Publish: powerguard/1/data       │                                   │
       │  {"current":0.682,"power":150.04} │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │  Receive & store in database      │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │                                   │  User toggles outlet via app      │
       │                                   │                                   │
       │                                   │  Publish: powerguard/1/control    │
       │                                   │  {"state": false}                 │
       │                                   │<──────────────────────────────────│
       │                                   │                                   │
       │  Receive control command          │                                   │
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
       │  Turn OFF outlet 1                │                                   │
       │                                   │                                   │
```

## Example MQTT Messages (For Testing)

You can test with an MQTT client (like MQTT Explorer) to simulate the STM32:

**Publish power data** (simulating STM32 sending data):
```
Topic: powerguard/1/data
Message: {"current":0.682,"power":150.04,"energy":0.1234}
```

**Subscribe to control** (simulating STM32 receiving commands):
```
Topic: powerguard/+/control
Expected messages: {"state":true} or {"state":false}
```

## Questions?

If you have questions about the implementation, check:
- `backend/src/mqtt/mqtt.service.ts` - Main MQTT service
- `mqtt-simulator/index.js` - Standalone simulator (reference implementation)
- `mqtt-simulator/README.md` - Simulator documentation
