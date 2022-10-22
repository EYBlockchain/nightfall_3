FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y netcat

EXPOSE 80

ENTRYPOINT ["/app/docker-entrypoint.sh"]

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /common-files
RUN npm ci
RUN npm link

WORKDIR /app

COPY nightfall-client/src src
COPY nightfall-client/docker-entrypoint.sh nightfall-client/package.json nightfall-client/package-lock.json ./

RUN npm link @polygon-nightfall/common-files
RUN npm ci

COPY common-files/classes node_modules/@polygon-nightfall/common-files/classes
COPY common-files/utils node_modules/@polygon-nightfall/common-files/utils
COPY common-files/constants node_modules/@polygon-nightfall/common-files/constants

CMD ["npm", "start"]
