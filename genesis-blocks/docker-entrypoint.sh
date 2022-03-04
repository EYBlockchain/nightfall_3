#! /bin/bash
set -o errexit
set -o pipefail
DEPLOYER_HOST=genesis-blocks_deployer_1
# wait until there's a optimist instance up
while ! nc -z ${CLIENT_HOST:-client} ${CLIENT_PORT:-80}; do sleep 3; done
while true; do 
  if ping -c 1 -W 1 "$DEPLOYER_HOST"; then
    echo "$DEPLOYER_HOST is alive";
    sleep 3;
  else
    echo "$DEPLOYER_HOST has finished";
    break;
  fi
done
exec "$@"
