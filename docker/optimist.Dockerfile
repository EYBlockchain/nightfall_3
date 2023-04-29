FROM node:16.17-bullseye-slim

# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 80 8080 9229

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci

WORKDIR /app
COPY nightfall-optimist/src src
COPY nightfall-optimist/docker-entrypoint.sh nightfall-optimist/package*.json ./

RUN npm ci

CMD ["npm", "start"]
