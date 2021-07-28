#! /bin/bash
set -o errexit
set -o nounset
set -o pipefail
# wait until there's a blockchain client up
while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done

#sleep 10

npm start
