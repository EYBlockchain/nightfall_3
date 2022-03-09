#! /bin/bash
set -o errexit
set -o pipefail

if [ -z "${USE_INFURA}" ] && [ -z "${ETH_PRIVATE_KEY}" ]; then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi
if [ -z "$UPGRADE" ]; then
echo 'Deploying contracts'
npx truffle migrate --to 3 --network=${ETH_NETWORK}
fi
if [ -n "${UPGRADE}" ]; then
  echo 'Upgrading contracts'
  npx truffle compile --all
  npx truffle migrate -f 4 --network=${ETH_NETWORK} --skip-dry-run
fi

npm start
