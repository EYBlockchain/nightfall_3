#! /bin/bash
set -e
trap "./ganache-standalone -d; docker-compose down -v; exit 1" SIGHUP SIGINT SIGTERM
# first, start up nightfall and deploy the contracts
./ganache-standalone -s
docker-compose -f docker-compose.yml -f docker-compose.stubs.yml -f docker-compose.host.docker.internal.yml up client optimist deployer --remove-orphans -d
echo 'waiting for deployer to finish'
docker wait ping-pong-deployer-1
echo 'deployer finished, running apps'
TEST_LENGTH=0 ./pong-apps
echo 'running deployer with upgrade set'
docker-compose -f docker-compose.yml -f docker-compose.stubs.yml -f docker-compose.host.docker.internal.yml run -e UPGRADE=true deployer -d
docker wait ping-pong-deployer-1
TEST_LENGTH=0 ./pong-apps
./ganache-standalone -d
./pong-down -v
