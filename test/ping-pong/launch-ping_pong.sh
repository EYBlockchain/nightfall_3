#! /bin/bash

PROPOSER_KEY=(0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d 0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb)
PROPOSER_PORT=(8092 8093)
OPTIMIST_PORT=(9091 9093)
OPTIMIST_WS_PORT=(9090 9092)
MONGO_PORT=(27019 27020)
MONGO_INITDB_ROOT_USERNAME=mongo
MONGO_INITDB_ROOT_PASSWORD=mongo

cd ../..

for (( i=1; i<=${#PROPOSER_KEY[@]} ; i++ ))
do
  # Stop optimist container
  OPTIMIST_PROCESS_ID=$(docker ps --no-trunc | grep proposer_optimist_${i} | awk '{print $1}' || true)
  if [ "${OPTIMIST_PROCESS_ID}" ]; then
    docker stop "${OPTIMIST_PROCESS_ID}"
  fi

  # Stop proposer container
  PROPOSER_PROCESS_ID=$(docker ps --no-trunc | grep proposer_${i} | awk '{print $1}' || true)
  if [ "${PROPOSER_PROCESS_ID}" ]; then
    docker stop "${PROPOSER_PROCESS_ID}"
  fi

  # MONGODB volume
  MONGODB=/var/lib/nightfall/optimist_mongodb_${i}

  # Stop mongo container
  MONGO_PROCESS_ID=$(docker ps --no-trunc | grep optimist_mongodb_${i} | awk '{print $1}' || true)
  if [ "${MONGO_PROCESS_ID}" ]; then
    docker stop "${MONGO_PROCESS_ID}"
    docker rm "${MONGO_PROCESS_ID}"
    sudo rm -rf ${MONGODB}
  fi
  
  sudo mkdir -p /var/lib/nightfall
  sudo mkdir -p ${MONGODB}

  # If we use ./start-nightfall script, then assume we are using ganache. Retrieve IP to establish connection
  OPTIMIST_VOLUME_STRING="--mount source=nightfall_3_build,destination=/app/build"
  BLOCKCHAIN_CONTAINER_ID=$(docker ps  --no-trunc | grep ganache | awk '{print $1}')
  BLOCKCHAIN_IP=$(docker network inspect nightfall_3_nightfall_network | jq ".[0].Containers.\"${BLOCKCHAIN_CONTAINER_ID}\"".IPv4Address | tr -d "\"")
  BLOCKCHAIN_IP=${BLOCKCHAIN_IP::-3}
  BLOCKCHAIN_URL=ws://${BLOCKCHAIN_IP}:8546

  echo "Launching optimist_mongodb_${i} container..."
  docker run -d \
   -v ${MONGODB}:/data/db \
   -p ${MONGO_PORT[i-1]}:27017 \
   --name optimist_mongodb_${i} \
   --network=nightfall_3_nightfall_network  \
   -e MONGO_INITDB_ROOT_PASSWORD=${MONGO_INITDB_ROOT_PASSWORD} \
   -e MONGO_INITDB_ROOT_USERNAME=${MONGO_INITDB_ROOT_USERNAME} \
   mongo

  sleep 5

  # retrieve mongodb container IP 
  MONGO_CONTAINER_ID=$(docker ps  --no-trunc | grep optimist_mongodb_${i} | awk '{print $1}')

  MONGO_IP=$(docker network inspect nightfall_3_nightfall_network | jq ".[0].Containers.\"${MONGO_CONTAINER_ID}\"".IPv4Address | tr -d "\"")
  MONGO_IP=${MONGO_IP::-3}

  sudo docker build \
  --build-arg OPTIMIST_PORT=${OPTIMIST_PORT[i-1]} \
  --build-arg OPTIMIST_WS_PORT=${OPTIMIST_WS_PORT[i-1]} \
  -f docker/optimist.standalone.Dockerfile . -t nightfall-optimist-${i}:latest

  echo "Launching proposer_optimist_${i} container..."
  docker run --rm -d \
    --name proposer_optimist_${i} \
    ${OPTIMIST_VOLUME_STRING} \
    --network=nightfall_3_nightfall_network \
    -p ${OPTIMIST_WS_PORT[i-1]}:8080 \
    -p ${OPTIMIST_PORT[i-1]}:80 \
    -e MONGO_CONNECTION_STRING="mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${MONGO_IP}:27017/" \
    -e MONGO_URL=${MONGO_IP} \
    -e WEBSOCKET_PORT=8080 \
    -e BLOCKCHAIN_URL=${BLOCKCHAIN_URL} \
    -e HASH_TYPE=poseidon \
    -e LOG_LEVEL=debug \
    -e TRANSACTIONS_PER_BLOCK=2 \
    -e AUTOSTART_RETRIES=10000 \
    nightfall-optimist-${i}:latest

  echo "Launching proposer_${i} ${PROPOSER_PORT[i-1]} ${PROPOSER_KEY[i-1]}"
  docker run --rm -d --name proposer_${i} \
    -v ${PWD}/apps/proposer/src:/app/src \
    --network nightfall_3_nightfall_network \
    -p ${PROPOSER_PORT[i-1]}:${PROPOSER_PORT[i-1]} \
    -e PROPOSER_HOST=proposer_${i} \
    -e PROPOSER_PORT=${PROPOSER_PORT[i-1]} \
    -e PROPOSER_KEY=${PROPOSER_KEY[i-1]} \
    -e BLOCKCHAIN_WS_HOST=${BLOCKCHAIN_IP} \
    -e BLOCKCHAIN_PORT=8546 \
    -e ENABLE_QUEUE=1 \
    -e OPTIMIST_HOST=proposer_optimist_${i} \
    -e OPTIMIST_PORT=80 \
    -e OPTIMIST_WS_PORT=8080 \
    -e CLIENT_HOST=client \
    -e CLIENT_PORT=8080 nightfall_3_proposer:latest   
done
echo "Launching ping-pong test..."
NO_PROPOSERS=1 npm run ping-pong