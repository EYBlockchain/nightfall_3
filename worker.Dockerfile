# build zokrates from source for local verify
FROM ghcr.io/eyblockchain/local-zokrates:0.7.13 as builder

FROM node:16.17


RUN apt-get update -y
RUN apt-get install -y netcat-openbsd curl nodejs gcc g++ make
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -

EXPOSE 80

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

WORKDIR /
COPY common-files common-files
WORKDIR /common-files
RUN npm ci

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

CMD ["npm", "start"]
