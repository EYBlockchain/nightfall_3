# build circom from source for local verify
FROM ghcr.io/eyblockchain/local-circom as builder
FROM ghcr.io/eyblockchain/local-rapidsnark as rapidsnark

FROM ubuntu:20.04

RUN apt-get update -y
RUN apt-get install -y netcat curl
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs gcc g++ make
RUN apt install -y build-essential
RUN apt-get install -y libgmp-dev
RUN apt-get install -y libsodium-dev
RUN apt-get install -y nasm

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
COPY --from=rapidsnark /app/rapidsnark/build/prover /app/prover
COPY ./worker/package.json ./worker/package-lock.json ./
COPY ./worker/src ./src
COPY ./worker/start-script ./start-script
COPY ./worker/start-dev ./start-dev

RUN npm ci

COPY common-files/classes node_modules/@polygon-nightfall/common-files/classes
COPY common-files/utils node_modules/@polygon-nightfall/common-files/utils
COPY common-files/constants node_modules/@polygon-nightfall/common-files/constants

CMD ["npm", "start"]
