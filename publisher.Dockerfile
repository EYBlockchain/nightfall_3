FROM node:14.17

WORKDIR /app
COPY common-files common-files
COPY config/default.js config/default.js
COPY config/default.js /app/test/pub-sub/publisher/config/default.js
COPY cli cli
WORKDIR /app/cli
RUN npm ci

WORKDIR /app/test/pub-sub/publisher
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY test/pub-sub/publisher/package*.json test/pub-sub/publisher/pre-start-script.sh ./
COPY test/pub-sub/publisher/src src
COPY test/pub-sub/publisher/docker-entrypoint.sh docker-entrypoint.sh

# websocket port 8080
EXPOSE 8080

RUN npm ci
ENTRYPOINT ["/app/test/pub-sub/publisher/docker-entrypoint.sh"]

CMD ["npm", "start"]
