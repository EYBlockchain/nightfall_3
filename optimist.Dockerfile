# build zokrates from source for local verify
FROM rust:1.53.0 as builder
WORKDIR /app
COPY . .
# Zokrates 0.7.10
RUN git clone --depth 1 --branch 0.7.10 https://github.com/Zokrates/ZoKrates.git
WORKDIR /app/ZoKrates
# For Mac Silicon this will default to aarch64-unknown-linux-gnu
RUN rustup toolchain install nightly
RUN cargo +nightly build --release

FROM mongo:focal
# install node
RUN apt-get update

# TEMPORARY WORKAROUND FOR ISSUE https://github.com/nodesource/distributions/issues/1266
RUN apt-get install -y ca-certificates

RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs gcc g++ make
RUN apt-get install -y netcat
# installs libs required for zokrates
RUN apt-get install -y libgmpxx4ldbl libgmp3-dev

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /app
RUN mkdir /app/mongodb

COPY nightfall-optimist/src src
COPY nightfall-optimist/docker-entrypoint.sh nightfall-optimist/pre-start-script.sh nightfall-optimist/package*.json ./
COPY --from=builder /app/ZoKrates/zokrates_stdlib/stdlib /root/.zokrates/stdlib
COPY --from=builder /app/ZoKrates/target/release/zokrates /app/

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

RUN npm ci

EXPOSE 80

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
