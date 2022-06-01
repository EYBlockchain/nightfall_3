#!/usr/bin/env bash
# wait until a local mongo instance has started
mongod --dbpath /app/mongodb/ --fork --logpath /var/log/mongodb/mongod.log --bind_ip_all
while ! nc -z localhost 27017; do sleep 3; done
echo 'mongodb started'

if [ -z "${USE_EXTERNAL_NODE}" ];
then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

exec "$@"
