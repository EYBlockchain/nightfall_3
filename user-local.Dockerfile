FROM node:14.17

WORKDIR /app
COPY common-files common-files
COPY config app/config
COPY config /app/test/ping-pong/user-local/config
COPY cli cli
WORKDIR /app/common-files
RUN npm ci
WORKDIR /app/cli
RUN npm ci

WORKDIR /app/test/ping-pong/user-local
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY test/ping-pong/user-local/package*.json ./
COPY test/ping-pong/user-local/src src
COPY test/ping-pong/user-local/docker-entrypoint.sh docker-entrypoint.sh
COPY test/utils /app/test/utils
COPY test/deploy-contracts /app/test/deploy-contracts

# websocket port 8080
EXPOSE 8080

RUN npm ci
ENTRYPOINT ["/app/test/ping-pong/user-local/docker-entrypoint.sh"]

CMD ["npm", "start"]
