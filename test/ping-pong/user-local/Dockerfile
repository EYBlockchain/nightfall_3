FROM node:14.17

WORKDIR /app
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

WORKDIR /common-files
RUN echo "{\"name\": \"common-files\"}" > package.json

WORKDIR /test/ping-pong/user-local

COPY src src
COPY docker-entrypoint.sh pre-start-script.sh package.json package-lock.json ./

RUN npm ci

EXPOSE 80

ENTRYPOINT ["/test/ping-pong/user-local/docker-entrypoint.sh"]

CMD ["npm", "start"]
