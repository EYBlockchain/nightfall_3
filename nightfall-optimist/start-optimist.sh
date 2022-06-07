#! /bin/bash
set -x

if [ -f optimist.env ]; then
  grep -v '^#' optimist.env
  # Export env vars
  export $(grep -v '^#' optimist.env | xargs)
else
  echo "optimist.env does not exist. You need to define the optimist.env with the needed variables to run an optimist."
  exit 1
fi

usage()
{
  echo "Usage:"
  echo "  -d or --delete_db; delete mongo db contents"
}

while [ -n "$1" ]; do
  case $1 in
      -d  | --delete_db )           sudo rm -rf ${VOLUMES}/mongodb/*
	                            ;;
      -h  | --help )                usage
                                    ;;
      * )                           usage
                              exit 1
    esac
  shift
done


VOLUMES=${PWD}/volumes
S3_CONTRACTS=nightfallv3-proving-files.s3.eu-west-1.amazonaws.com/testnet/build
mkdir -p ${VOLUMES}
mkdir -p ${VOLUMES}/mongodb
mkdir -p ${VOLUMES}/build
mkdir -p ${VOLUMES}/build/contracts

curl ${S3_CONTRACTS}/hash.txt --output hash.txt 2> /dev/null

# Update S3 contracts if different from the ones locally stored
if [ ! -f ${VOLUMES}/build/hash.txt ]; then
  echo "empty" > ${VOLUMES}/build/hash.txt
fi
DIFF=$(cmp ${VOLUMES}/build/hash.txt hash.txt)

if [ "${DIFF}" ]; then
  while read -r remote; do
    HASH=$(echo $remote | awk '{print $1}')
    CONTRACT_NAME=$(echo $remote | awk '{print $2}')
    curl ${S3_CONTRACTS}/contracts/${CONTRACT_NAME} --output ${VOLUMES}/build/contracts/${CONTRACT_NAME} 2> /dev/null
  done < hash.txt
  cp hash.txt ${VOLUMES}/build/hash.txt
fi

docker stop mongodb_1
docker rm mongodb_1
docker stop optimist_1
docker rm optimist_1
echo "Launching mongodb container..."
docker run -d \
 -v ${VOLUMES}/mongodb:/data/db \
 -p 27017:27017 \
 --name mongodb_1 \
 -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_INITDB_ROOT_PASSWORD} \
 -e MONGO_INITDB_ROOT_USERNAME=${MONGO_INITDB_ROOT_USERNAME} \
 mongo

cd .. && sudo docker build -f optimist.standalone.Dockerfile . -t nightfall-optimist:latest

echo "Launching optimist..."
docker run --rm -d \
  --name optimist_1 \
  -v ${VOLUMES}/build:/app/build \
  -e MONGO_URL=${MONGO_URL} \
  -e MONGO_INITDB_ROOT_USERNAME=${MONGO_INITDB_ROOT_PASSWORD} \
  -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_INITDB_ROOT_USERNAME} \
  -e WEBSOCKET_PORT=8080 \
  -e BLOCKCHAIN_URL=${BLOCKCHAIN_URL} \
  -e HASH_TYPE=mimc \
  -e LOG_LEVEL=debug \
  -e TRANSACTIONS_PER_BLOCK=32 \
  -e AUTOSTART_RETRIES=10000 \
  nightfall-optimist:latest

