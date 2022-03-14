#! /bin/bash
set -o errexit
set -o pipefail
DEPLOYER_HOST=nightfall_3_deployer_1
# wait until there's a optimist instance up
while ! nc -z ${OPTIMIST_HOST:-optimist} ${OPTIMIST_PORT:-80}; do sleep 3; done
while true; do 
  if ping -c 1 -W 1 "${DEPLOYER_HOST:-deployer}" > /dev/null 2>&1; then
    # echo "${DEPLOYER_HOST:-deployer} is alive";
    sleep 3;
  else
    # echo "${DEPLOYER_HOST:-deployer} has finished";
    break;
  fi
done
exec "$@"
