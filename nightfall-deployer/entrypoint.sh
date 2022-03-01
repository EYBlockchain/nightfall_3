#! /bin/bash
set -o errexit
set -o pipefail

if [ -z "${USE_INFURA}" ] && [ -z "${ETH_PRIVATE_KEY}" ]; then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi
npx truffle compile --all
npx truffle migrate --to 3 --network=${ETH_NETWORK}

if [ -n "${UPGRADE}" ]; then
  npx truffle migrate -f 4 --reset --network=${ETH_NETWORK}
fi

#sleep 10

npm start
