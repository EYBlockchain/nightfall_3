# build circom from source for local verify
FROM ghcr.io/eyblockchain/local-circom as builder

FROM ubuntu:20.04

RUN apt-get update -y
RUN apt-get install -y netcat curl
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs gcc g++ make

EXPOSE 80

ENV CIRCOM_HOME /app

WORKDIR /
COPY common-files common-files
WORKDIR /common-files
RUN npm ci

WORKDIR /app
COPY config/default.js config/default.js
COPY /nightfall-deployer/circuits circuits
COPY --from=builder /app/circom/target/release/circom /app/circom
COPY ./worker/package.json ./worker/package-lock.json ./
COPY ./worker/src ./src
COPY ./worker/start-script ./start-script
COPY ./worker/start-dev ./start-dev

RUN npm ci

CMD ["npm", "start"]
