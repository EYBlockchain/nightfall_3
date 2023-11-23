# build circom from source for local verify
FROM rust:1.74.0-slim as builder

ARG USERNAME=app_user
ARG USER_UID=1001
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN chown -R $USERNAME:$USERNAME /app

USER $USERNAME
# Circom
RUN git clone -b 'v2.1.2' --single-branch https://github.com/iden3/circom.git

WORKDIR /app/circom
# For Mac Silicon this will default to aarch64-unknown-linux-gnu
RUN rustup toolchain install stable
RUN cargo +stable build --release