#! /bin/bash
set -o errexit
set -o pipefail

if [ -z "${USE_INFURA}" ]
then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

#sleep 10

npm start
