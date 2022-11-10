# build circom from source for local verify
FROM rust:1.53.0 as builder
WORKDIR /app
# Circom
RUN git clone -b 'v2.1.2' --single-branch https://github.com/iden3/circom.git

WORKDIR /app/circom
# For Mac Silicon this will default to aarch64-unknown-linux-gnu
RUN rustup toolchain install nightly
RUN cargo +nightly build --release
