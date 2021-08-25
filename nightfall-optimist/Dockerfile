FROM mongo:4.4.1-bionic

# install node
RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y netcat

WORKDIR /common-files
RUN echo "{\"name\": \"common-files\"}" > package.json

WORKDIR /app
RUN mkdir /app/mongodb

COPY src src
COPY docker-entrypoint.sh pre-start-script.sh package.json package-lock.json ./

RUN npm ci

EXPOSE 80

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
