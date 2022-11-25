#! /bin/bash
set -o errexit
set -o pipefail
# wait until there's a optimist instance up
while ! nc -z ${OPTIMIST_HOST:-optimist} ${OPTIMIST_PORT:-80}; do sleep 3; done
# wait to finish deployer
sleep 300
exec "$@"