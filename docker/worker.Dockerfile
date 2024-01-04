# build circom from source for local verify
FROM ghcr.io/eyblockchain/local-circom as builder
FROM  node:18.19.0-bullseye-slim

ARG USERNAME=app_user
ARG USER_UID=1001
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME

USER root
# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN  apt-get update \
    &&  apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    &&  rm -rf /var/lib/apt/lists/*


# EXPOSE 80

ENV CIRCOM_HOME /app

WORKDIR /

COPY --chown=$USERNAME common-files common-files

WORKDIR /common-files

RUN npm ci

WORKDIR /app

COPY  config/default.js config/default.js
COPY  /nightfall-deployer/circuits circuits
COPY   --from=builder /app/circom/target/release/circom /app/circom
COPY  ./worker/package.json ./worker/package-lock.json ./
COPY  ./worker/src ./src
COPY  ./worker/start-script ./start-script
COPY  ./worker/start-dev ./start-dev

RUN mkdir /app/output

RUN chown -R $USERNAME:$USERNAME /app/output

RUN npm ci

USER $USERNAME

CMD ["npm", "start"]