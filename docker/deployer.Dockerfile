FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

ENTRYPOINT ["/app/entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci
RUN npm link

WORKDIR /app
COPY nightfall-deployer/package*.json ./
COPY nightfall-deployer/src src
COPY nightfall-deployer/contracts contracts
COPY nightfall-deployer/migrations migrations
COPY nightfall-deployer/truffle-config.js truffle-config.js
COPY nightfall-deployer/circuits circuits
COPY nightfall-deployer/entrypoint.sh entrypoint.sh

RUN npm link @polygon-nightfall/common-files
RUN npm ci
