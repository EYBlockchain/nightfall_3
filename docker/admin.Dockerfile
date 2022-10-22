FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y netcat

ENTRYPOINT ["/app/admin/docker-entrypoint.sh"]

WORKDIR /app
COPY common-files common-files
COPY cli cli

WORKDIR /app/common-files
RUN npm ci
RUN npm link


WORKDIR /app/cli
RUN npm ci

WORKDIR /app/admin
COPY config/default.js config/default.js
COPY nightfall-administrator/src src
COPY nightfall-administrator/docker-entrypoint.sh nightfall-administrator/package*.json nightfall-administrator/admin ./

RUN npm link @polygon-nightfall/common-files
RUN npm ci
COPY common-files/classes node_modules/@polygon-nightfall/common-files/classes
COPY common-files/utils node_modules/@polygon-nightfall/common-files/utils
COPY common-files/constants node_modules/@polygon-nightfall/common-files/constants

CMD ["sleep", "infinity"]
