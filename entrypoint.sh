#! /bin/bash
set -o errexit
set -o nounset
set -o pipefail

npx truffle migrate --network=${ETH_NETWORK:=openethereum}

sleep 10

npm start
