FROM node:18.19.1-bullseye-slim

# 'node-gyp' requires 'python3', 'make' and 'g++''
# entrypoint script requires 'netcat'
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 80 9229

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci

WORKDIR /app

COPY nightfall-client/src src
COPY nightfall-client/docker-entrypoint.sh nightfall-client/package.json nightfall-client/package-lock.json ./

RUN npm ci

CMD ["npm", "start"]
