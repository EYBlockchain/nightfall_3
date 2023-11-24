FROM node:20.9.0-bullseye-slim

ARG USERNAME=app_user
ARG USER_UID=1001
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME

# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /
COPY --chown=$USERNAME common-files common-files
COPY --chown=$USERNAME config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci

WORKDIR /app
RUN chown -R $USERNAME:$USER_GID /app
COPY --chown=$USERNAME nightfall-deployer/package*.json ./
COPY --chown=$USERNAME nightfall-deployer/src src
COPY --chown=$USERNAME nightfall-deployer/contracts contracts
COPY --chown=$USERNAME nightfall-deployer/migrations migrations
COPY --chown=$USERNAME nightfall-deployer/truffle-config.js truffle-config.js
COPY --chown=$USERNAME nightfall-deployer/circuits circuits
COPY --chown=$USERNAME nightfall-deployer/entrypoint.sh entrypoint.sh

RUN npm ci --production

ENTRYPOINT ["/app/entrypoint.sh"]