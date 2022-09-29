docker build -t ghcr.io/eyblockchain/local-zokrates:0.8.2 -f docker/zokrates.Dockerfile .
docker-compose -f docker/docker-compose.client.yml -f docker/docker-compose.client.dev.yml client build
docker-compose -f docker/docker-compose.client.yml -f docker/docker-compose.client.dev.yml deployer build
docker-compose -f docker/docker-compose.client.yml -f docker/docker-compose.client.dev.yml worker build