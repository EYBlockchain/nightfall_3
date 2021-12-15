FROM node:14.17

WORKDIR /app
COPY common-files common-files
COPY config/default.js config/default.js
COPY config/default.js /app/test/ping-pong/user-local1/config/default.js
COPY cli cli
WORKDIR /app/cli
RUN npm ci

WORKDIR /app/test/ping-pong/user-local1
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY test/ping-pong/user-local1/package*.json test/ping-pong/user-local1/pre-start-script.sh ./
COPY test/ping-pong/user-local1/src src
COPY test/ping-pong/user-local1/docker-entrypoint.sh docker-entrypoint.sh

# websocket port 8080
EXPOSE 8080

RUN npm ci
ENTRYPOINT ["/app/test/ping-pong/user-local1/docker-entrypoint.sh"]

CMD ["npm", "start"]
