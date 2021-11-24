#!/usr/bin/env bash

rm -rf cli
cp -R ../cli .
NF_DOCKER_SELENITY=$(docker images | grep nightfall_3_selenium | awk '{print $3}')
if [ ! -z ${NF_DOCKER_SELENITY} ]; then
  docker rmi -f ${NF_DOCKER_SELENITY}
fi


