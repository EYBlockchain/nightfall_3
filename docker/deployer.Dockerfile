FROM node:18.19.0-bullseye-slim

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
<<<<<<< HEAD
COPY nightfall-deployer/package*.json ./
COPY nightfall-deployer/src src
COPY nightfall-deployer/contracts contracts
COPY nightfall-deployer/scripts scripts
COPY nightfall-deployer/hardhat.config.js hardhat.config.js
COPY nightfall-deployer/circuits circuits
COPY nightfall-deployer/entrypoint.sh entrypoint.sh
=======
RUN chown -R $USERNAME:$USERNAME /app

USER $USERNAME

COPY --chown=$USERNAME nightfall-deployer/package*.json ./
COPY --chown=$USERNAME nightfall-deployer/src src
COPY --chown=$USERNAME nightfall-deployer/contracts contracts
COPY --chown=$USERNAME nightfall-deployer/migrations migrations
COPY --chown=$USERNAME nightfall-deployer/truffle-config.js truffle-config.js
COPY --chown=$USERNAME nightfall-deployer/circuits circuits
COPY --chown=$USERNAME nightfall-deployer/entrypoint.sh entrypoint.sh

RUN mkdir -p /app/build/contracts
RUN mkdir /app/.openzeppelin

RUN chown -R $USERNAME:$USERNAME /app/build/contracts
RUN chown -R $USERNAME:$USERNAME /app/.openzeppelin

>>>>>>> c29a30a2 (feat: fix node version 18)

RUN npm ci

ENTRYPOINT ["/app/entrypoint.sh"]
