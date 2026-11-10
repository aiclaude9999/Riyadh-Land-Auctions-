#!/bin/sh
# Runs the web app and the background worker in ONE container (used for single-service hosting, e.g. Render).
# Applies database migrations first. If either process exits, the container exits so the platform restarts it.
set -e
npx prisma migrate deploy
npx tsx src/worker/index.ts &
WORKER=$!
npx next start -p "${PORT:-3000}" -H 0.0.0.0 &
WEB=$!
trap 'kill $WORKER $WEB 2>/dev/null' TERM INT
# exit as soon as one of them stops
while kill -0 $WORKER 2>/dev/null && kill -0 $WEB 2>/dev/null; do sleep 5; done
echo "a process stopped — exiting so the platform restarts the service"
kill $WORKER $WEB 2>/dev/null || true
exit 1
