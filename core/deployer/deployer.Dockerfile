FROM node:14.17

WORKDIR /app

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

COPY ./lib lib
COPY ./config/default.js config/default.js
COPY ./core/deployer/package*.json ./
COPY ./core/deployer/src src
COPY ./core/deployer/contracts contracts
COPY ./core/deployer/migrations migrations
COPY ./core/deployer/truffle-config.js truffle-config.js
COPY ./core/deployer/circuits circuits
COPY ./core/deployer/entrypoint.sh entrypoint.sh

RUN npm i
RUN npm link /app/lib/common-files --save

ENTRYPOINT [ "/app/entrypoint.sh" ]
