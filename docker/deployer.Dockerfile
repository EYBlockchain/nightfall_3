FROM node:16.17-bullseye-slim

# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/app/entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci

WORKDIR /app
COPY nightfall-deployer/package*.json ./
COPY nightfall-deployer/src src
COPY nightfall-deployer/contracts contracts
COPY nightfall-deployer/migrations migrations
COPY nightfall-deployer/truffle-config.js truffle-config.js
COPY nightfall-deployer/circuits circuits
COPY nightfall-deployer/entrypoint.sh entrypoint.sh

RUN npm ci
