# build zokrates from source for local verify
FROM rust:1.53.0 as builder

RUN apt-get update -y
RUN apt-get install -y cmake

WORKDIR /app
# Zokrates 0.7.13
RUN git clone --depth 1 --branch 0.7.13 https://github.com/Zokrates/ZoKrates.git

WORKDIR /app/ZoKrates
# For Mac Silicon this will default to aarch64-unknown-linux-gnu
RUN rustup toolchain install nightly
RUN cargo +nightly build -p zokrates_cli --release
