# STM32 MQTT Implementation Guide

This document describes the exact MQTT topics and message formats your STM32 should use. The backend simulator already uses these same topics, so when your STM32 is ready, you can swap it in with **NO code changes needed**.

## ⚠️ Important: Timer Architecture

**Timers run ON the STM32/simulator, NOT on the backend!** This makes the system foolproof:
- Timers work even if internet connection is lost
- Outlets turn off reliably when timer expires
- Backend just mirrors the timer state for the UI

**For Development/Testing:**
- You MUST run the mqtt-simulator (or connect real STM32)
- Without it, timers won't complete and outlets won't turn off
- Backend has a 5-second fallback check, but the simulator is the primary timer executor

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

**Important Note**: The STM32 should **always publish** data (even when outlet is OFF), but the backend **will not store** 0 values in the database to prevent flooding. This design allows:
- Device online/offline monitoring (backend knows if STM32 is connected)
- Efficient database usage (only stores meaningful power consumption data)
- Accurate energy tracking (energy only accumulates when power > 0)

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

### 2. Control Topic (Outlet ON/OFF)

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

### 3. Timer Start Topic

**Topic Pattern**: `powerguard/{outletId}/timer/start`

**Examples**:
- `powerguard/1/timer/start` - Start timer for outlet 1
- `powerguard/2/timer/start` - Start timer for outlet 2

**Message Format**: JSON
```json
{
  "durationSeconds": 3600,
  "source": "MANUAL"
}
```

**Field Descriptions**:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `durationSeconds` | integer | Timer duration in seconds | 3600 (1 hour) |
| `source` | string | Timer source: `"MANUAL"` or `"GEOFENCE"` | "MANUAL" |

**STM32 Behavior**:
1. Receive timer start command
2. Start local hardware timer (using RTC or hardware timer)
3. Publish initial status immediately (see Timer Status Topic)
4. Publish status updates every 10 seconds
5. When timer expires: turn OFF outlet and publish final status

**Example C Code**:
```c
typedef struct {
    uint32_t durationSeconds;
    uint32_t remainingSeconds;
    bool isActive;
    char source[10];  // "MANUAL" or "GEOFENCE"
} OutletTimer;

OutletTimer timers[4]; // One timer per outlet

void onTimerStartReceived(int outletId, char* payload) {
    // Parse JSON payload
    uint32_t duration;
    char source[10];
    parseTimerStartJson(payload, &duration, source);

    // Stop existing timer if any
    if (timers[outletId-1].isActive) {
        stopTimer(outletId);
    }

    // Start new timer
    timers[outletId-1].durationSeconds = duration;
    timers[outletId-1].remainingSeconds = duration;
    timers[outletId-1].isActive = true;
    strncpy(timers[outletId-1].source, source, sizeof(timers[outletId-1].source));

    // Start hardware timer (configure RTC alarm or hardware timer)
    startHardwareTimer(outletId, duration);

    // Publish initial status
    publishTimerStatus(outletId);

    printf("Timer started for outlet %d: %lu seconds\n", outletId, duration);
}
```

### 4. Timer Stop Topic

**Topic Pattern**: `powerguard/{outletId}/timer/stop`

**Examples**:
- `powerguard/1/timer/stop` - Stop timer for outlet 1
- `powerguard/2/timer/stop` - Stop timer for outlet 2

**Message Format**: JSON
```json
{
  "reason": "cancelled"
}
```

**Field Descriptions**:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `reason` | string | Reason for stopping (informational) | "cancelled", "power_off", "replaced" |

**STM32 Behavior**:
1. Receive timer stop command
2. Cancel active timer
3. Publish final status with `isActive: false`

**Example C Code**:
```c
void onTimerStopReceived(int outletId, char* payload) {
    if (!timers[outletId-1].isActive) {
        return; // No active timer
    }

    // Stop hardware timer
    stopHardwareTimer(outletId);

    // Clear timer state
    timers[outletId-1].isActive = false;
    timers[outletId-1].remainingSeconds = 0;

    // Publish final status
    publishTimerStatus(outletId);

    printf("Timer stopped for outlet %d\n", outletId);
}
```

## Topics the STM32 Must Publish To (Timer Status)

### 5. Timer Status Topic

**Topic Pattern**: `powerguard/{outletId}/timer/status`

**Examples**:
- `powerguard/1/timer/status` - Timer status for outlet 1
- `powerguard/2/timer/status` - Timer status for outlet 2

**Message Format**: JSON
```json
{
  "isActive": true,
  "remainingSeconds": 1785,
  "durationSeconds": 3600,
  "source": "MANUAL"
}
```

**Field Descriptions**:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `isActive` | boolean | Whether timer is currently running | true |
| `remainingSeconds` | integer | Seconds remaining until outlet turns off | 1785 |
| `durationSeconds` | integer | Original timer duration | 3600 |
| `source` | string or null | Timer source: `"MANUAL"`, `"GEOFENCE"`, or null | "MANUAL" |

**Publishing Frequency**:
- Immediately after receiving start/stop command
- Every 10 seconds while timer is active
- Immediately when timer completes

**STM32 Behavior**:
1. Maintain timer state in memory
2. Publish status every 10 seconds while timer is active
3. When timer expires:
   - Turn OFF the physical outlet relay
   - Publish final status with `isActive: false, remainingSeconds: 0`
   - Backend will detect completion and automatically:
     - Update outlet state in database
     - Create timer completion log
     - Send notification to user (for MANUAL timers)

**Example C Code**:
```c
void publishTimerStatus(int outletId) {
    char topic[50];
    char message[200];
    OutletTimer* timer = &timers[outletId-1];

    // Build topic
    sprintf(topic, "powerguard/%d/timer/status", outletId);

    // Build JSON message
    if (timer->isActive) {
        sprintf(message,
            "{\"isActive\":true,\"remainingSeconds\":%lu,\"durationSeconds\":%lu,\"source\":\"%s\"}",
            timer->remainingSeconds, timer->duration, timer->source);
    } else {
        sprintf(message,
            "{\"isActive\":false,\"remainingSeconds\":0,\"durationSeconds\":0,\"source\":null}");
    }

    // Publish to MQTT broker
    mqtt_publish(topic, message, QOS_0, false);
}

// Call this function every 10 seconds for active timers
void timerStatusUpdateTask() {
    for (int i = 0; i < 4; i++) {
        if (timers[i].isActive) {
            publishTimerStatus(i + 1);
        }
    }
}

// Hardware timer interrupt handler (called every second)
void hardwareTimerISR() {
    for (int i = 0; i < 4; i++) {
        if (timers[i].isActive && timers[i].remainingSeconds > 0) {
            timers[i].remainingSeconds--;

            if (timers[i].remainingSeconds == 0) {
                // Timer expired - turn off outlet
                setOutletState(i + 1, false);
                timers[i].isActive = false;

                // Publish final status
                publishTimerStatus(i + 1);

                printf("Timer completed for outlet %d - turned OFF\n", i + 1);
            }
        }
    }
}
```

## Complete STM32 Implementation Checklist

### Initial Setup
- [ ] Connect to Public EMQX MQTT broker (port 1883)
- [ ] Use broker address from environment variables
- [ ] Authentication is optional for public broker

### Subscribe to Control and Timer Topics
- [ ] Subscribe to `powerguard/+/control` on startup (outlet ON/OFF)
- [ ] Subscribe to `powerguard/+/timer/start` on startup (timer commands)
- [ ] Subscribe to `powerguard/+/timer/stop` on startup (cancel timer)
- [ ] Implement message handler to route messages by topic
- [ ] Control physical outlets based on received state

### Publish Power Data
- [ ] Measure current, power, and energy for each outlet
- [ ] Calculate cumulative energy (kWh) for each outlet
- [ ] **Always publish** to `powerguard/{outletId}/data` every 5 seconds (even if outlet is OFF)
- [ ] Format message as JSON: `{"current": X.XXX, "power": XX.XX, "energy": X.XXXX}`
- [ ] When outlet is OFF, send `{"current": 0.000, "power": 0.00, "energy": X.XXXX}`
- [ ] Backend will automatically skip storing 0 values (prevents database flooding)

### Implement Timer Functionality
- [ ] Create timer state storage for each outlet (durationSeconds, remainingSeconds, isActive, source)
- [ ] Implement hardware timer (RTC or TIM peripheral) to decrement remainingSeconds every second
- [ ] Handle timer start commands: parse JSON, start local timer, publish initial status
- [ ] Handle timer stop commands: cancel timer, publish final status
- [ ] Publish timer status to `powerguard/{outletId}/timer/status` every 10 seconds while active
- [ ] **When timer expires**:
  - [ ] Turn OFF physical relay (control GPIO pin)
  - [ ] Publish final status with `isActive: false, remainingSeconds: 0`
  - [ ] Backend will automatically handle database updates and notifications
- [ ] If outlet is manually turned OFF while timer is active: stop timer and publish status

### Error Handling
- [ ] Handle MQTT connection loss and reconnect automatically
- [ ] Re-subscribe to all topics after reconnection (control, timer/start, timer/stop)
- [ ] Handle invalid JSON messages gracefully
- [ ] Persist active timers to non-volatile memory (optional, for power loss recovery)
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

## Message Flow Diagrams

### Basic Outlet Control Flow

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

### Timer Flow (Complete Lifecycle)

```
┌─────────────┐                    ┌──────────────┐                    ┌──────────────┐
│   STM32     │                    │ MQTT Broker  │                    │   Backend    │
│  (Hardware) │                    │ (Public EMQX)│                    │  (NestJS)    │
└─────────────┘                    └──────────────┘                    └──────────────┘
       │                                   │                                   │
       │  Subscribe: timer topics          │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │  Subscribe: timer/status          │
       │                                   │<──────────────────────────────────│
       │                                   │                                   │
       │                                   │  User starts 1hr timer via app    │
       │                                   │                                   │
       │                                   │  Publish: powerguard/1/timer/start│
       │                                   │  {"durationSeconds":3600,         │
       │                                   │   "source":"MANUAL"}              │
       │                                   │<──────────────────────────────────│
       │                                   │                                   │
       │  Receive timer start              │                                   │
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
       │  Start hardware timer (1 hour)    │                                   │
       │                                   │                                   │
       │  Publish: timer/status (initial)  │                                   │
       │  {"isActive":true,                │                                   │
       │   "remainingSeconds":3600,...}    │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │  Receive & update database        │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │  [Every 10 seconds]               │                                   │
       │  Publish: timer/status            │                                   │
       │  {"isActive":true,                │                                   │
       │   "remainingSeconds":3450,...}    │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │  Receive & update database        │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │  ... (continues for 1 hour) ...   │                                   │
       │                                   │                                   │
       │  Timer expires (remaining = 0)    │                                   │
       │  Turn OFF outlet 1                │                                   │
       │                                   │                                   │
       │  Publish: timer/status (final)    │                                   │
       │  {"isActive":false,               │                                   │
       │   "remainingSeconds":0,...}       │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │  Receive & update database        │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │                                   │  App UI shows timer complete      │
       │                                   │                                   │
```

### Timer Cancellation Flow

```
┌─────────────┐                    ┌──────────────┐                    ┌──────────────┐
│   STM32     │                    │ MQTT Broker  │                    │   Backend    │
│  (Hardware) │                    │ (Public EMQX)│                    │  (NestJS)    │
└─────────────┘                    └──────────────┘                    └──────────────┘
       │                                   │                                   │
       │  [Timer is active]                │                                   │
       │                                   │                                   │
       │                                   │  User cancels timer               │
       │                                   │                                   │
       │                                   │  Publish: powerguard/1/timer/stop │
       │                                   │  {"reason":"cancelled"}           │
       │                                   │<──────────────────────────────────│
       │                                   │                                   │
       │  Receive timer stop               │                                   │
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
       │  Cancel hardware timer            │                                   │
       │                                   │                                   │
       │  Publish: timer/status (final)    │                                   │
       │  {"isActive":false,               │                                   │
       │   "remainingSeconds":0,...}       │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │  Receive & update database        │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
```

## Example MQTT Messages (For Testing)

You can test with an MQTT client (like MQTT Explorer) to simulate the STM32:

### Power Data (STM32 → Backend)
**Publish power data** (simulating STM32 sending data):
```
Topic: powerguard/1/data
Message: {"current":0.682,"power":150.04,"energy":0.1234}
```

### Outlet Control (Backend → STM32)
**Subscribe to control** (simulating STM32 receiving commands):
```
Topic: powerguard/+/control
Expected messages: {"state":true} or {"state":false}
```

### Timer Commands (Backend → STM32)
**Subscribe to timer start** (simulating STM32 receiving timer commands):
```
Topic: powerguard/+/timer/start
Expected message: {"durationSeconds":3600,"source":"MANUAL"}
```

**Subscribe to timer stop** (simulating STM32 receiving cancel commands):
```
Topic: powerguard/+/timer/stop
Expected message: {"reason":"cancelled"}
```

### Timer Status (STM32 → Backend)
**Publish timer status** (simulating STM32 sending status updates):
```
Topic: powerguard/1/timer/status
Message (active): {"isActive":true,"remainingSeconds":1785,"durationSeconds":3600,"source":"MANUAL"}
Message (inactive): {"isActive":false,"remainingSeconds":0,"durationSeconds":0,"source":null}
```

## Summary: Key Topics for STM32

### Subscribe To (Receive Commands):
1. `powerguard/+/control` - ON/OFF commands: `{"state": true/false}`
2. `powerguard/+/timer/start` - Timer start: `{"durationSeconds": 3600, "source": "MANUAL"}`
3. `powerguard/+/timer/stop` - Timer cancel: `{"reason": "cancelled"}`

### Publish To (Send Data):
1. `powerguard/{id}/data` - Power data every 5s: `{"current": 0.682, "power": 150.04, "energy": 0.1234}`
2. `powerguard/{id}/timer/status` - Timer status every 10s: `{"isActive": true, "remainingSeconds": 1785, ...}`

## Reference Implementation

The **mqtt-simulator** (`mqtt-simulator/index.js`) is a complete Node.js implementation that behaves exactly like the STM32 should. Your friend can:
1. Study the simulator code to understand the expected behavior
2. Copy the timer logic pattern to C for STM32
3. Test the backend with the simulator before implementing STM32

## Questions?

If you have questions about the implementation, check:
- `mqtt-simulator/index.js` - **Complete reference implementation with timer logic**
- `backend/src/mqtt/mqtt.service.ts` - Backend MQTT service (subscribes to timer status)
- `backend/src/timer/timer.service.ts` - Backend timer service (publishes timer commands)
- `mqtt-simulator/README.md` - Simulator documentation
