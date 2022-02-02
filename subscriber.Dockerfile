FROM node:14.17

WORKDIR /app
COPY common-files common-files
COPY config/default.js config/default.js
COPY config/default.js /app/test/pub-sub/subscriber/config/default.js
COPY cli cli
WORKDIR /app/cli
RUN npm ci

WORKDIR /app/test/pub-sub/subscriber
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY test/pub-sub/subscriber/package*.json test/pub-sub/publisher/pre-start-script.sh ./
COPY test/pub-sub/subscriber/src src
COPY test/pub-sub/subscriber/docker-entrypoint.sh docker-entrypoint.sh

# websocket port 8080
EXPOSE 8080

RUN npm ci
ENTRYPOINT ["/app/test/pub-sub/subscriber/docker-entrypoint.sh"]

CMD ["npm", "start"]
