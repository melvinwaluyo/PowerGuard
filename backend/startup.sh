#!/bin/bash

# Generate Prisma Client
npx prisma generate

# Start the application
node dist/main.js
