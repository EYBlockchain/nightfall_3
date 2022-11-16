#!/usr/bin/env bash
if [ "${TX_WORKER_COUNT}" ]; then
  node /app/src/workers/transaction-submitted-app.mjs >> /proc/1/fd/1 &
fi
exec "$@"
