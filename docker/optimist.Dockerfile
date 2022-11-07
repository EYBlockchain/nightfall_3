# build zokrates from source for local verify
FROM ghcr.io/eyblockchain/local-zokrates:0.8.2 as builder

FROM node:16.17

# install node
RUN apt-get update
RUN apt-get install -y netcat

# installs libs required for zokrates
RUN apt-get install -y libgmpxx4ldbl libgmp3-dev

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

EXPOSE 80 8080 9229

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci
RUN npm link

WORKDIR /app
COPY nightfall-optimist/src src
COPY nightfall-optimist/docker-entrypoint.sh nightfall-optimist/package*.json ./
COPY --from=builder /app/ZoKrates/zokrates_stdlib/stdlib /root/.zokrates/stdlib
COPY --from=builder /app/ZoKrates/target/release/zokrates /app/

RUN npm ci

COPY common-files/classes node_modules/@polygon-nightfall/common-files/classes
COPY common-files/utils node_modules/@polygon-nightfall/common-files/utils
COPY common-files/constants node_modules/@polygon-nightfall/common-files/constants

CMD ["npm", "start"]
