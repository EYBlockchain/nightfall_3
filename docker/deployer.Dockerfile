FROM node:20.9.0-bullseye-slim

ARG USERNAME=app_user
ARG USER_UID=1001
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME

USER root

# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# ENTRYPOINT ["/app/entrypoint.sh"]

USER $USERNAME

WORKDIR /

COPY --chown=$USERNAME common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci

# RUN mkdir /app
# RUN chown -R $USERNAME:$USERNAME /app
USER root
WORKDIR /app
RUN chown -R $USERNAME:$USERNAME /app

USER $USERNAME

COPY --chown=$USERNAME nightfall-deployer/package*.json ./
COPY --chown=$USERNAME nightfall-deployer/src src
COPY --chown=$USERNAME nightfall-deployer/contracts contracts
COPY --chown=$USERNAME nightfall-deployer/migrations migrations
COPY --chown=$USERNAME nightfall-deployer/truffle-config.js truffle-config.js
COPY --chown=$USERNAME nightfall-deployer/circuits circuits
COPY --chown=$USERNAME nightfall-deployer/entrypoint.sh entrypoint.sh


RUN npm install --no-optional

ENTRYPOINT ["/app/entrypoint.sh"]
