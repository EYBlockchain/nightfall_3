FROM node:14.17

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /app
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY test/ping-pong/user-local/package*.json test/ping-pong/proposer/pre-start-script.sh ./
COPY test/ping-pong/user-local/src src
COPY test/ping-pong/user-local/docker-entrypoint.sh docker-entrypoint.sh

# websocket port 8080
EXPOSE 8080

RUN npm ci
ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
