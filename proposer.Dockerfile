FROM node:14.17

WORKDIR /app
COPY common-files common-files
COPY config/default.js config/default.js
COPY config/default.js /app/core/proposer/config/default.js
COPY cli cli
WORKDIR /app/common-files
RUN npm ci
WORKDIR /app/cli
RUN npm ci

WORKDIR /app/core/proposer
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY core/proposer/package*.json ./
COPY core/proposer/src src
COPY core/proposer/docker-entrypoint.sh docker-entrypoint.sh

# websocket port 8080
EXPOSE 8080

RUN npm ci
ENTRYPOINT ["/app/core/proposer/docker-entrypoint.sh"]

CMD ["npm", "start"]
