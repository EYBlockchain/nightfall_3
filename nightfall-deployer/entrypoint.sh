#! /bin/bash
set -o errexit
set -o pipefail

if [ -z "${USE_INFURA}" ] && [ -z "${ETH_PRIVATE_KEY}" ] && [ -z "${USE_HOSTED_GETH}" ]; then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

npx truffle migrate --network=${ETH_NETWORK}

#sleep 10

npm start
