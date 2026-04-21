#!/bin/sh
set -e

# Start nginx in background
nginx -g "daemon off;" &

# Start Bun API
cd /app/backend
exec bun run src/index.ts
