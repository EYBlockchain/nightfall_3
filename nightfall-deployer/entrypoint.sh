#! /bin/bash
set -o errexit
set -o pipefail

if [ -z "${ETH_PRIVATE_KEY}" ]; then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
  echo "${BLOCKCHAIN_WS_HOST}:${BLOCKCHAIN_PORT}"
fi

if [[ "${SKIP_DEPLOYMENT}" != "true" ]]; then
  npx hardhat compile --force
  echo "Compiled these contracts:"
  ls ./artifacts/contracts
  ls ./artifacts/contracts/mocks
  if [ -z "${UPGRADE}" ]; then
    echo "Deploying contracts to ${ETH_NETWORK}"
    npx hardhat --network "${ETH_NETWORK}" run scripts/deploy.js 
    echo 'Contracts deployed successfully'
  else
    echo 'Upgrading contracts is not implemented yet'
    # npx hardhat --network "${ETH_NETWORK}" run scripts/upgrade.js
  fi
fi

npm start
