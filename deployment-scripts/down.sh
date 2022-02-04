#! /bin/bash

# brings all containers down, deletes all volumes except for the trusted setup

docker-compose -p nightfall down --remove-orphans
docker volume rm nightfall_build
