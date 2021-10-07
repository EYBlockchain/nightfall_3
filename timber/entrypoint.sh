#! /bin/bash
set -o errexit
set -o pipefail

# check if testnet url exist: this means there is no
# local blockchain running instead we are trying to to connect
# testnet network via infura
if [ -z "${BLOCKCHAIN_URL}" ]
then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

#sleep 10

npm start
