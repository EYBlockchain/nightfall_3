FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y netcat

ENTRYPOINT ["/app/admin/docker-entrypoint.sh"]

WORKDIR /app
COPY cli cli

WORKDIR /app/cli
RUN npm ci

WORKDIR /app/admin
COPY config/default.js config/default.js
COPY nightfall-administrator/src src
COPY nightfall-administrator/docker-entrypoint.sh nightfall-administrator/package*.json nightfall-administrator/admin ./

RUN npm ci

CMD ["sleep", "infinity"]
