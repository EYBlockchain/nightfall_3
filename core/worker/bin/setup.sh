#!/bin/sh
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

printf "\n${GREEN}*** Starting zokrates container ***${NC}\n"
docker-compose up -d api

# delay needed to ensure all container are in running state.
# sleep 5

printf "\n${GREEN}*** Running setup for test.zok ***${NC}\n"
curl -d '{"filepath": "examples/test.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys

printf "\n${GREEN}*** Running setup for square.zok ***${NC}\n"
curl -d '{"filepath": "examples/square.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys

printf "\n${GREEN}*** Running setup for prove-ownership-of-sk.zok ***${NC}\n"
curl -d '{"filepath": "examples/prove-ownership-of-sk.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys


printf "\n${GREEN}*** Setups complete ***${NC}\n"
