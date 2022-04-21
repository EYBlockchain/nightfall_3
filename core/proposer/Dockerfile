FROM node:14.17

RUN apt-get update -y
RUN apt-get install -y netcat-openbsd

WORKDIR /common-files
RUN echo "{\"name\": \"common-files\"}" > package.json

WORKDIR /

COPY ./core/proposer/src src
COPY ./core/proposer/docker-entrypoint.sh ./core/proposer/pre-start-script.sh ./core/proposer/package.json ./core/proposer/package-lock.json ./

RUN npm ci

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["npm", "start"]
