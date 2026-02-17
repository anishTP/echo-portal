#!/bin/sh
set -e

echo "Running database migrations..."
node /app/backend/migrate.mjs

echo "Starting server..."
exec node backend/dist/index.js
