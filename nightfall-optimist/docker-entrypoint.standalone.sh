#!/usr/bin/env bash
if [ "${TX_WORKER_COUNT}" ]; then
  mkdir -p /tmp
  # TX_WORKER_DOCKER sets docker mode to 1
  TX_WORKER_DOCKER=1 node /app/src/workers/transaction-submitted-app.mjs > /tmp/worker.txt &
fi
exec "$@"
