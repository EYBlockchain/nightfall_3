#! /bin/bash
set -o errexit
set -o pipefail
# wait until there's a optimist instance up
while ! nc -z ${OPTIMIST_HOST:-optimist} ${OPTIMIST_PORT:-80}; do sleep 3; done
sleep 5
# wait to finish deployer
while ping -q -c 1 ${DEPLOYER_HOST:-deployer} >/dev/null ; do sleep 5; done
exec "$@"