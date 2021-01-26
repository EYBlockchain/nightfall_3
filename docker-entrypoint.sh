#!/usr/bin/env bash

# wait until there's a blockchain client up
while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done

exec "$@"
