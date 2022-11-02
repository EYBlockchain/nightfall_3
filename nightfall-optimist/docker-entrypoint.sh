#!/usr/bin/env bash

if [ -z "${USE_EXTERNAL_NODE}" ];
then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

if [ "${TX_WORKER_COUNT}" ]; then
  mkdir -f /tmp
  node /app/src/workers/transaction-submitted-app.mjs > /tmp/worker.txt &
fi
exec "$@"
