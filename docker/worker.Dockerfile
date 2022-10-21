# build zokrates from source for local verify
FROM ghcr.io/eyblockchain/local-zokrates:0.8.2 as builder

FROM ubuntu:20.04

RUN apt-get update -y
RUN apt-get install -y netcat curl
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs gcc g++ make

EXPOSE 80

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

WORKDIR /
COPY common-files common-files
WORKDIR /common-files
RUN npm ci
RUN npm link

WORKDIR /app
COPY config/default.js config/default.js
COPY /nightfall-deployer/circuits circuits
COPY --from=builder /app/ZoKrates/zokrates_stdlib/stdlib /app/stdlib
COPY --from=builder /app/ZoKrates/target/release/zokrates /app/zokrates
COPY ./zokrates-worker/package.json ./zokrates-worker/package-lock.json ./
COPY ./zokrates-worker/src ./src
COPY ./zokrates-worker/circuits ./circuits
COPY ./zokrates-worker/start-script ./start-script
COPY ./zokrates-worker/start-dev ./start-dev

RUN npm ci
RUN npm link @polygon-nightfall/common-files

CMD ["npm", "start"]
