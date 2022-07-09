FROM mongo:4.4.1-bionic

# install node
RUN apt-get update

# TEMPORARY WORKAROUND FOR ISSUE https://github.com/nodesource/distributions/issues/1266
RUN apt-get install -y ca-certificates

RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y netcat

WORKDIR /
COPY common-files common-files
COPY config app/config

WORKDIR /app
RUN mkdir /app/mongodb

COPY nightfall-client/src src
COPY nightfall-client/docker-entrypoint.sh nightfall-client/pre-start-script.sh nightfall-client/package.json nightfall-client/package-lock.json ./

RUN npm ci

EXPOSE 27017
EXPOSE 80

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
