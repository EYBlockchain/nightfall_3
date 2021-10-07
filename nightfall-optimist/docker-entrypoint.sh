#!/usr/bin/env bash
# wait until a local mongo instance has started
mongod --dbpath /app/mongodb/ --fork --logpath /var/log/mongodb/mongod.log --bind_ip_all
while ! nc -z localhost 27017; do sleep 3; done
echo 'mongodb started'

# check if testnet url exist: this means there is no
# local blockchain running instead we are trying to to connect
# testnet network via infura
if [ -z "${BLOCKCHAIN_URL}" ]
then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

exec "$@"
