FROM node:16.17-bullseye-slim

# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/app/docker-entrypoint.sh"]

WORKDIR /
COPY common-files common-files
WORKDIR /common-files
RUN npm ci

WORKDIR /app/app
COPY apps/proposer/package*.json ./
COPY apps/proposer/src src
COPY apps/proposer/docker-entrypoint.sh docker-entrypoint.sh
COPY config config

RUN npm ci

CMD ["npm", "start"]
