#!/usr/bin/env bash
mongod --dbpath /app/mongodb/ --fork --logpath /var/log/mongodb/mongod.log --bind_ip_all
while ! nc -z localhost 27017; do sleep 3; done
echo 'mongodb started'

if [ -z "${USE_EXTERNAL_NODE}" ];
then
  # wait until there's a blockchain client up
  while ! nc -z ${BLOCKCHAIN_WS_HOST} ${BLOCKCHAIN_PORT}; do sleep 3; done
fi

# wait until there's a zokrates worker host up
while ! nc -z ${ZOKRATES_WORKER_HOST} 80; do sleep 3; done

# wait until there's a rabbitmq server up
if [ $ENABLE_QUEUE == "1" ]
then
  while ! nc -z ${RABBITMQ_HOST:7} $RABBITMQ_PORT; do sleep 3; done
fi

exec "$@"
