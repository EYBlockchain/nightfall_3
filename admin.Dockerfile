FROM node:14.17

WORKDIR /app
COPY common-files common-files
COPY config/default.js config/default.js
COPY config/default.js /app/admin/config/default.js
COPY cli cli
WORKDIR /app/common-files
RUN npm ci
WORKDIR /app/cli
RUN npm ci

WORKDIR /app/admin
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY nightfall-administrator/src src
COPY nightfall-administrator/docker-entrypoint.sh nightfall-administrator/package*.json nightfall-administrator/admin ./

# websocket port 8080
# EXPOSE 8080

RUN npm ci
ENTRYPOINT ["/app/admin/docker-entrypoint.sh"]

CMD ["sleep", "infinity"]
