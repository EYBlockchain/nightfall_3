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
