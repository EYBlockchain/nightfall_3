#!/usr/bin/env bash
mongod --dbpath /app/mongodb/ --fork --logpath /var/log/mongodb/mongod.log
while ! nc -z localhost 27017; do sleep 3; done
echo 'mongodb started'
exec "$@"
