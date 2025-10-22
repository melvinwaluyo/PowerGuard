# PowerGuard Backend

NestJS backend server for PowerGuard smart outlet management system with PostgreSQL and HiveMQ MQTT integration.

## Features

- **PostgreSQL Database**: Azure-hosted database with Prisma ORM
- **MQTT Integration**: Real-time communication with STM32 devices via HiveMQ
- **RESTful API**: Endpoints for managing power strips, outlets, and usage data
- **Real-time Data**: Automatic storage of power consumption data from MQTT messages

## Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL (Azure)
- **ORM**: Prisma
- **MQTT**: HiveMQ Cloud
- **Protocol**: MQTT over TLS (mqtts)

## Prerequisites

- Node.js 18+
- npm or yarn
- Access to Azure PostgreSQL database
- Access to HiveMQ Cloud MQTT broker

## Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Environment variables are already configured in `.env`

3. Generate Prisma client:
```bash
npx prisma generate
```

## Database Setup

The Prisma schema is already configured with the following tables:
- **PowerStrip**: Power strip devices
- **Outlet**: Individual outlets in power strips
- **UsageLog**: Power consumption history
- **NotificationLog**: Notification messages
- **GeofenceSetting**: Location-based automation settings

To sync with the existing database:
```bash
npx prisma db pull  # Pull schema from database
npx prisma generate # Regenerate client
```

## Running the Server

### Development mode:
```bash
npm run start:dev
```

### Production mode:
```bash
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000`

## API Documentation

**Swagger/OpenAPI Documentation:** `http://localhost:3000/docs`

An interactive API documentation is available at the `/docs` endpoint. You can:
- View all available endpoints
- See request/response schemas
- Test API calls directly in your browser
- No need for Postman!

Simply open `http://localhost:3000/docs` in your browser after starting the server.

## API Endpoints

### Power Strips

- `GET /powerstrips` - Get all power strips with outlets
- `GET /powerstrips/:id` - Get specific power strip
- `POST /powerstrips` - Create new power strip

### Outlets

- `GET /outlets` - Get all outlets
- `GET /outlets/:id` - Get specific outlet
- `PATCH /outlets/:id/state` - Control outlet state (on/off)
  ```json
  { "state": true }
  ```
- `GET /outlets/:id/usage-logs?limit=100` - Get usage history
- `GET /outlets/:id/recent-usage` - Get latest usage data

## MQTT Integration

### Topic Structure

**Receiving data from STM32:**
- Topic: `powerguard/{outlet_id}/data`
- Payload format:
  ```json
  {
    "current": 1.5,
    "power": 330,
    "energy": 0.5
  }
  ```

**Controlling outlets:**
- Topic: `powerguard/{outlet_id}/control`
- Payload format:
  ```json
  {
    "state": true
  }
  ```

### How it works

1. Backend subscribes to `powerguard/+/data` on startup
2. When STM32 publishes power data, backend automatically stores it in `UsageLog` table
3. Frontend can call `PATCH /outlets/:id/state` to control outlets
4. Backend publishes MQTT message to `powerguard/{outlet_id}/control`
5. STM32 receives command and updates outlet state

## Project Structure

```
backend/
├── src/
│   ├── mqtt/              # MQTT service and module
│   ├── outlets/           # Outlets endpoints
│   ├── powerstrips/       # Power strips endpoints
│   ├── prisma.service.ts  # Database service
│   ├── app.module.ts      # Main app module
│   └── main.ts            # Entry point
├── prisma/
│   └── schema.prisma      # Database schema
└── .env                   # Environment variables
```

## Testing the Setup

### 1. Check database connection:
```bash
npx prisma db pull
```

### 2. Start server and check logs for:
```
Database connected successfully
Connected to HiveMQ MQTT broker
Subscribed to powerguard/+/data
```

### 3. Test API endpoints:
```bash
curl http://localhost:3000/outlets
curl http://localhost:3000/powerstrips
```

## When STM32 is Ready

Once you configure your STM32 to publish to HiveMQ:

1. **Publish power data** to topic: `powerguard/{outlet_id}/data`
2. Backend will automatically receive and store in database
3. Frontend can fetch data via: `GET /outlets/:id/usage-logs`

## Team - Capstone A04

- Fatihan Fawwasanie - 22/493173/TK/54009
- Athaya Harmana Putri - 22/492673/TK/53930
- Melvin Waluyo - 22/492978/TK/53972
- Randy Mahendra - 22/504684/TK/55213
- Muhammad Haidar S. - 22/499808/TK/54766
