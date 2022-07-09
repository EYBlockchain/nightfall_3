FROM node:14.17

WORKDIR /
COPY common-files common-files
COPY config app/config

WORKDIR /app
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY nightfall-deployer/package*.json nightfall-deployer/pre-start-script.sh ./
COPY nightfall-deployer/src src
COPY nightfall-deployer/contracts contracts
COPY nightfall-deployer/migrations migrations
COPY nightfall-deployer/truffle-config.js truffle-config.js
COPY nightfall-deployer/circuits circuits
COPY nightfall-deployer/entrypoint.sh entrypoint.sh

RUN npm ci
ENTRYPOINT ["/app/entrypoint.sh"]
