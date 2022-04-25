FROM node:14.17

WORKDIR /app

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

COPY ./config/default.js config/default.js
COPY ./lib lib

COPY ./core/proposer/src src
COPY ./core/proposer/entrypoint.sh ./core/proposer/package*.json ./

RUN ls -la 

RUN npm i
RUN npm link /app/lib/common-files --save
RUN npm link /app/lib/nf3 --save

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
