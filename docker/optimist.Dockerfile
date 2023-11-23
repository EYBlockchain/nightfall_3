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

USER $USERNAME

EXPOSE 80 8080 9229

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY --chown=$USERNAME common-files common-files
COPY --chown=$USERNAME config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci

USER root
WORKDIR /app
RUN chown -R $USERNAME:$USERNAME /app
 
USER $USERNAME

COPY --chown=$USERNAME nightfall-optimist/src src
COPY --chown=$USERNAME nightfall-optimist/docker-entrypoint.sh nightfall-optimist/package*.json ./

RUN npm ci

CMD ["npm", "start"]
