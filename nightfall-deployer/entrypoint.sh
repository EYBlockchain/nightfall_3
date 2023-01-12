#! /bin/bash
set -o errexit
set -o pipefail

if [ -z "${ETH_PRIVATE_KEY}" ]; then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

if [ "${SKIP_DEPLOYMENT}" != "true" ]; then
  npx truffle compile --all

  if [ -z "${UPGRADE}" ]; then
    echo 'Deploying contracts'
    npx truffle migrate --to 3 --network=${ETH_NETWORK}
  else
    echo 'Upgrading contracts'
    npx truffle migrate -f 4 --network=${ETH_NETWORK} --skip-dry-run
  fi
fi

npm start
