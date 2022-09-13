FROM node:16.17

WORKDIR /app
COPY common-files common-files
COPY cli cli
WORKDIR /app/common-files
RUN npm ci
WORKDIR /app/cli
RUN npm ci

WORKDIR /app
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY apps/proposer/package*.json ./
COPY apps/proposer/src src
COPY apps/proposer/docker-entrypoint.sh docker-entrypoint.sh
COPY config config

# websocket port 8080
EXPOSE 8080

RUN npm i
ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
