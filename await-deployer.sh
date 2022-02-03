#! /bin/bash

# Wait until deployer is up and then wait until it exists.  Useful if you need
# to wait until nightfall is deployed before you can do something

while :
do
  if [[ `docker ps` = *deployer* ]]; then
    break
  fi
  sleep 1
done
echo 'deployer container detected'
while :
do
  if [[ `docker ps` != *deployer* ]]; then
    break
  fi
  sleep 1
done
echo 'deployer container has exited'
