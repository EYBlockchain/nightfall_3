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
    python3 make g++ netcat-openbsd iputils-ping\
    && rm -rf /var/lib/apt/lists/*


USER $USERNAME

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/app/docker-entrypoint.sh"]

WORKDIR /
COPY --chown=$USERNAME common-files common-files
WORKDIR /common-files
RUN npm ci

USER root
WORKDIR /app
RUN chown -R $USERNAME:$USERNAME /app

USER $USERNAME

WORKDIR /app/app
COPY --chown=$USERNAME cli cli
WORKDIR /app/app/cli
RUN npm ci

WORKDIR /app/app
COPY --chown=$USERNAME apps/proposer/package*.json ./
COPY --chown=$USERNAME apps/proposer/src src
COPY --chown=$USERNAME apps/proposer/docker-entrypoint.sh docker-entrypoint.sh
COPY --chown=$USERNAME config config

RUN npm ci

# COPY common-files/classes node_modules/common-files/classes
# COPY common-files/utils node_modules/common-files/utils
# COPY common-files/constants node_modules/common-files/constants

CMD ["npm", "start"]