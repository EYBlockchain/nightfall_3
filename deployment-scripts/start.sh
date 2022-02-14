#! /bin/bash

# Wait until deployer is up and then wait until it exists.  Useful if you need
# to wait until nightfall is deployed before you can do something

docker-compose -p nightfall --profile servers up -d
# Now wait whie deployer runs up, does it's thing, and exits
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

docker-compose -p nightfall --profile applications up -d
