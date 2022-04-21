# build zokrates from source for local verify
FROM ghcr.io/eyblockchain/local-zokrates as builder

FROM ubuntu:20.04
WORKDIR /app

COPY ./config/default.js config/default.js
COPY ./core/deployer/circuits circuits
COPY ./core/worker/package.json ./core/worker/package-lock.json ./
COPY --from=builder /app/ZoKrates/zokrates_stdlib/stdlib stdlib
COPY --from=builder /app/ZoKrates/target/release/zokrates zokrates
COPY ./core/worker/src ./src
COPY ./core/worker/circuits ./circuits
COPY ./core/worker/start-script ./start-script
COPY ./core/worker/start-dev ./start-dev

RUN apt-get update -y
RUN apt-get install -y netcat curl
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs gcc g++ make

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

RUN npm ci

EXPOSE 80
ENTRYPOINT [ "npm", "start" ] 
