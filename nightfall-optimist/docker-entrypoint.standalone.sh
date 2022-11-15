#!/usr/bin/env bash
if [ "${TX_WORKER_COUNT}" ]; then
  mkdir -p /tmp
  node /app/src/workers/transaction-submitted-app.mjs > /tmp/worker.txt &
fi
exec "$@"
