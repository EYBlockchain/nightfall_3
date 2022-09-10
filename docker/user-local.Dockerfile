FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/test/ping-pong/user-local/docker-entrypoint.sh"]

WORKDIR /app
COPY common-files common-files
COPY config/default.js config/default.js
COPY config/default.js /app/test/ping-pong/user-local/config/default.js
COPY cli cli

WORKDIR /app/common-files
RUN npm ci

WORKDIR /app/cli
RUN npm ci

WORKDIR /app/test/ping-pong/user-local
COPY test/ping-pong/user-local/package*.json ./
COPY test/ping-pong/user-local/src src
COPY test/ping-pong/user-local/docker-entrypoint.sh docker-entrypoint.sh

RUN npm ci

CMD ["npm", "start"]
