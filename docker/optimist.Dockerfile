# build zokrates from source for local verify
FROM ghcr.io/eyblockchain/local-zokrates:0.8.2 as builder

FROM mongo:focal

# install node
RUN apt-get update
# TEMPORARY WORKAROUND FOR ISSUE https://github.com/nodesource/distributions/issues/1266
RUN apt-get install -y ca-certificates
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs gcc g++ make
RUN apt-get install -y netcat
# installs libs required for zokrates
RUN apt-get install -y libgmpxx4ldbl libgmp3-dev

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

EXPOSE 80
# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /app
RUN mkdir /app/mongodb
COPY nightfall-optimist/src src
COPY nightfall-optimist/docker-entrypoint.sh nightfall-optimist/pre-start-script.sh nightfall-optimist/package*.json ./
COPY --from=builder /app/ZoKrates/zokrates_stdlib/stdlib /root/.zokrates/stdlib
COPY --from=builder /app/ZoKrates/target/release/zokrates /app/

RUN npm ci

CMD ["npm", "start"]
