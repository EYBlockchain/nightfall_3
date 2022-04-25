FROM node:14.17

WORKDIR /app
COPY ./lib lib
COPY ./config/default.js config/default.js

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY test/ping-pong/user-local/package*.json ./
COPY test/ping-pong/user-local/src src
COPY test/ping-pong/user-local/entrypoint.sh ./

# websocket port 8080
EXPOSE 8080

RUN npm i
RUN npm link /app/lib/common-files --save
RUN npm link /app/lib/nf3 --save
ENTRYPOINT ["/app/entrypoint.sh"]
