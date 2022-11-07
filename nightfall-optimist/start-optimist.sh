#! /bin/bash

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
  echo "  -e or --environment; start optimist on mainnet or testnet."
  echo "     If not added, it will start optimist to local setup created wih ./start-nightfall"
}

# MONGODB volume
MONGODB=/var/lib/nightfall/mongodb
sudo mkdir -p /var/lib/nightfall
sudo mkdir -p ${MONGODB}

while [ -n "$1" ]; do
  case $1 in
      -d  | --delete_db )           sudo rm -rf ${MONGODB}
                                    sudo mkdir -p ${MONGODB}
	                            ;;
      -e  | --environment )         DEPLOYMENT="$2"; 
                                    if [ "${DEPLOYMENT}" != "testnet" ] && [ "${DEPLOYMENT}" != "mainnet" ]; then
                                       echo "Incorrect Deployment ${DEPLOYMENT}"
                                       usage
                                       exit 0
                                    elif [ "${DEPLOYMENT}" = "mainnet" ]; then
                                       DEPLOYMENT=production
                                    fi   
                                    shift ;;
      -h  | --help )                usage
                                    ;;
      * )                           usage
                              exit 1
    esac
  shift
done

# Stop optimist and mongodb containers if they exist
./stop-optimist.sh


# If deploymeny
if [ ! -z "${DEPLOYMENT}" ]; then
  # Create folders where aux date will be stored
  #  VOLUMES -> stores build/contract volumes
  VOLUMES=${PWD}/volumes
  mkdir -p ${VOLUMES}
  mkdir -p ${VOLUMES}/build
  mkdir -p ${VOLUMES}/build/contracts
  
  # S3 buckect wehere mainnet/testnet contracts are stored
  S3_CONTRACTS=nightfallv3-proving-files.s3.eu-west-1.amazonaws.com/${DEPLOYMENT}/build
  curl ${S3_CONTRACTS}/hash.txt --output hash.txt 2> /dev/null
  
  # Update S3 contracts if different from the ones locally stored
  if [ ! -f ${VOLUMES}/build/hash.txt ]; then
    echo "empty" > ${VOLUMES}/build/hash.txt
  fi
  DIFF=$(cmp ${VOLUMES}/build/hash.txt hash.txt)
  
  if [ "${DIFF}" ]; then
    echo "Copying contracts"
    while read -r remote; do
      HASH=$(echo $remote | awk '{print $1}')
      CONTRACT_NAME=$(echo $remote | awk '{print $2}')
      curl ${S3_CONTRACTS}/contracts/${CONTRACT_NAME} --output ${VOLUMES}/build/contracts/${CONTRACT_NAME} 2> /dev/null
    done < hash.txt
    cp hash.txt ${VOLUMES}/build/hash.txt
  fi
  OPTIMIST_VOLUME_STRING="-v ${VOLUMES}/build:/app/build "

  echo "Launching mongodb container..."
  docker run -d \
   -v ${MONGODB}:/data/db \
   -p ${MONGO_PORT}:27017 \
   --name mongodb_1 \
   -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_INITDB_ROOT_PASSWORD} \
   -e MONGO_INITDB_ROOT_USERNAME=${MONGO_INITDB_ROOT_USERNAME} \
   mongo
else
  # If we use ./start-nightfall script, then assume we are using ganache. Retrieve IP to establish connection
  OPTIMIST_VOLUME_STRING="--mount source=nightfall_3_build,destination=/app/build"
  BLOCKCHAIN_CONTAINER_ID=$(docker ps  --no-trunc | grep ganache | awk '{print $1}')
  BLOCKCHAIN_IP=$(docker network inspect nightfall_3_nightfall_network | jq ".[0].Containers.\"${BLOCKCHAIN_CONTAINER_ID}\"".IPv4Address | tr -d "\"")
  BLOCKCHAIN_IP=${BLOCKCHAIN_IP::-3}
  BLOCKCHAIN_URL=ws://${BLOCKCHAIN_IP}:8546

  echo "Launching mongodb container..."
  docker run -d \
   -v ${MONGODB}:/data/db \
   -p ${MONGO_PORT}:27017 \
   --name mongodb_1 \
   --network=nightfall_3_nightfall_network  \
   -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_INITDB_ROOT_PASSWORD} \
   -e MONGO_INITDB_ROOT_USERNAME=${MONGO_INITDB_ROOT_USERNAME} \
   mongo
fi


sleep 5

# retrieve mongodb container IP 
MONGO_CONTAINER_ID=$(docker ps  --no-trunc | grep mongodb_1 | awk '{print $1}')
if [ ! -z "${DEPLOYMENT}" ]; then
  MONGO_IP=$(docker inspect ${MONGO_CONTAINER_ID} | jq ".[0].NetworkSettings.Networks.bridge.IPAddress" | tr -d "\"")
else
  MONGO_IP=$(docker network inspect nightfall_3_nightfall_network | jq ".[0].Containers.\"${MONGO_CONTAINER_ID}\"".IPv4Address | tr -d "\"")
  MONGO_IP=${MONGO_IP::-3}
fi

cd .. && sudo docker build \
 --build-arg OPTIMIST_PORT=${OPTIMIST_PORT} \
 --build-arg OPTIMIST_WS_PORT=${OPTIMIST_WS_PORT} \
 -f optimist.standalone.Dockerfile . -t nightfall-optimist:latest


if [ ! -z "${DEPLOYMENT}" ]; then
  echo "Launching optimist..."
  docker run --rm -d \
    --name optimist_1 \
    ${OPTIMIST_VOLUME_STRING} \
    -p ${OPTIMIST_WS_PORT}:8080 \
    -p ${OPTIMIST_PORT}:80 \
    -e MONGO_CONNECTION_STRING="mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${MONGO_IP}:27017/" \
    -e MONGO_URL=${MONGO_IP} \
    -e WEBSOCKET_PORT=8080 \
    -e BLOCKCHAIN_URL=${BLOCKCHAIN_URL} \
    -e HASH_TYPE=poseidon \
    -e LOG_LEVEL=debug \
    -e AUTOSTART_RETRIES=10000 \
    -e MAX_BLOCK_SIZE=50000 \
    nightfall-optimist:latest
else
  docker run --rm -d \
    --name optimist_1 \
    ${OPTIMIST_VOLUME_STRING} \
    --network=nightfall_3_nightfall_network \
    -p ${OPTIMIST_WS_PORT}:8080 \
    -p ${OPTIMIST_PORT}:80 \
    -e MONGO_CONNECTION_STRING="mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${MONGO_IP}:27017/" \
    -e MONGO_URL=${MONGO_IP} \
    -e WEBSOCKET_PORT=8080 \
    -e BLOCKCHAIN_URL=${BLOCKCHAIN_URL} \
    -e HASH_TYPE=poseidon \
    -e LOG_LEVEL=debug \
    -e AUTOSTART_RETRIES=10000 \
    -e MAX_BLOCK_SIZE=50000 \
    nightfall-optimist:latest
fi