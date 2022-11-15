FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /app
COPY common-files common-files
COPY cli cli
WORKDIR /app/common-files
RUN npm ci
RUN npm link

WORKDIR /app/cli
RUN npm ci

WORKDIR /app
COPY apps/proposer/package*.json ./
COPY apps/proposer/src src
COPY apps/proposer/docker-entrypoint.sh docker-entrypoint.sh
COPY config config

RUN npm ci

COPY common-files/classes node_modules/@polygon-nightfall/common-files/classes
COPY common-files/utils node_modules/@polygon-nightfall/common-files/utils
COPY common-files/constants node_modules/@polygon-nightfall/common-files/constants

CMD ["npm", "start"]
