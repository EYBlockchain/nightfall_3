FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

# websocket port 8080
EXPOSE 8080

WORKDIR /app
COPY common-files common-files
COPY cli cli
WORKDIR /app/common-files
RUN npm ci
WORKDIR /app/cli
RUN npm ci

WORKDIR /app
COPY apps/proposer/package.json ./
COPY apps/proposer/src src
COPY config config

RUN npm i

CMD ["npm", "start"]
