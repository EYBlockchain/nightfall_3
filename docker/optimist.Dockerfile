# build circom from source for local verify
FROM node:16.17

# install node
RUN apt-get update
RUN apt-get install -y netcat

EXPOSE 80
# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /app
COPY nightfall-optimist/src src
COPY nightfall-optimist/docker-entrypoint.sh nightfall-optimist/pre-start-script.sh nightfall-optimist/package*.json ./

RUN npm ci

CMD ["npm", "start"]
