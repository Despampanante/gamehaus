#!/bin/sh
set -e

# Validate nginx config before starting anything
nginx -t

nginx -g "daemon off;" &
NGINX_PID=$!

cd /app/backend
bun run src/index.ts &
BUN_PID=$!

# Forward signals to both children
trap "kill $NGINX_PID $BUN_PID 2>/dev/null; exit" TERM INT

# Poll until either process exits, then kill the other and let Docker restart
while kill -0 $NGINX_PID 2>/dev/null && kill -0 $BUN_PID 2>/dev/null; do
  sleep 2
done

echo "A process exited unexpectedly — stopping container"
kill $NGINX_PID $BUN_PID 2>/dev/null
exit 1
