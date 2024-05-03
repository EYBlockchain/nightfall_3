# build circom from source for local verify
FROM rust:1.53.0-slim as builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Circom
RUN git clone -b 'v2.1.2' --single-branch https://github.com/iden3/circom.git

WORKDIR /app/circom
# For Mac Silicon this will default to aarch64-unknown-linux-gnu
RUN rustup toolchain install stable
RUN cargo +stable build --release