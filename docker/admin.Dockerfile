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

CMD ["sleep", "infinity"]
