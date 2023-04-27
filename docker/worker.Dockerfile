# build circom from source for local verify
FROM ghcr.io/eyblockchain/local-circom as builder

FROM node:16.17-bullseye-slim

# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 80

ENV CIRCOM_HOME /app

WORKDIR /
COPY common-files common-files
WORKDIR /common-files
RUN npm ci
RUN npm link

WORKDIR /app
COPY config/default.js config/default.js
COPY /nightfall-deployer/circuits circuits
COPY --from=builder /app/circom/target/release/circom /app/circom
COPY ./worker/package.json ./worker/package-lock.json ./
COPY ./worker/src ./src
COPY ./worker/start-script ./start-script
COPY ./worker/start-dev ./start-dev

RUN npm ci

COPY common-files/classes node_modules/common-files/classes
COPY common-files/utils node_modules/common-files/utils
COPY common-files/constants node_modules/common-files/constants

CMD ["npm", "start"]
