#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/backend && npx drizzle-kit migrate
cd /app

echo "Starting server..."
exec node backend/dist/index.js
