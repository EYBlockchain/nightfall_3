#!/usr/bin/env bash

rm -rf cli
cp -R ../cli .
cp -R ../config/ .
NF_DOCKER_SELENITY=$(docker images | grep nightfall_3_wallet-test | awk '{print $3}')
if [ ! -z ${NF_DOCKER_SELENITY} ]; then
  docker rmi -f ${NF_DOCKER_SELENITY}
fi


