FROM node:14.17

WORKDIR /app
COPY ./common-files common-files

COPY ./config/default.js default.js

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY ./core/deployer/package*.json ./
COPY ./core/deployer/src src
COPY ./core/deployer/contracts contracts
COPY ./core/deployer/migrations migrations
COPY ./core/deployer/truffle-config.js truffle-config.js
COPY ./core/deployer/circuits circuits
COPY ./core/deployer/entrypoint.sh entrypoint.sh

RUN npm i
RUN npm link /app/common-files --save

ENTRYPOINT [ "/app/entrypoint.sh" ]
