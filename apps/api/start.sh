#!/bin/sh
set -e

echo "Running database push..."
npx prisma db push --force-reset --accept-data-loss

echo "Starting API server..."
node dist/main.js
