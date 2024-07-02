FROM node:18.19.0-bullseye-slim

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

EXPOSE 80 9229

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY --chown=$USERNAME common-files common-files
COPY --chown=$USERNAME config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci

WORKDIR /app

COPY --chown=$USERNAME nightfall-client/src src
COPY --chown=$USERNAME nightfall-client/docker-entrypoint.sh nightfall-client/package.json nightfall-client/package-lock.json ./

RUN npm ci

USER $USERNAME

CMD ["npm", "start"]