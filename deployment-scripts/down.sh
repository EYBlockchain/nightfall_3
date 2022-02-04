#! /bin/bash

# brings all containers down, deletes all volumes except for the trusted setup
VOLUME_LIST=$(docker volume ls -q)

docker-compose -p nightfall down --remove-orphans
if [[ $(echo $VOLUME_LIST | grep nightfall_build) ]]; then
  docker volume rm nightfall_build
fi
