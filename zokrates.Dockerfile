# build zokrates from source for local verify
FROM rust:1.53.0 as builder
WORKDIR /app
# Zokrates 0.7.13
RUN git clone --depth 1 --branch 0.7.13 https://github.com/Zokrates/ZoKrates.git
WORKDIR /app/ZoKrates
RUN cargo build --release --package zokrates_cli
