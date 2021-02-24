#! /bin/bash
set -o errexit
set -o nounset
set -o pipefail
# wait until there's a blockchain client up
while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
npx truffle migrate --network=${ETH_NETWORK:=openethereum} --reset

sleep 10

npm start
