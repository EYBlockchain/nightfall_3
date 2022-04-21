FROM mongo:4.4.1-bionic

# install node
RUN apt-get update

# TEMPORARY WORKAROUND FOR ISSUE https://github.com/nodesource/distributions/issues/1266
RUN apt-get install -y ca-certificates

RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y netcat

WORKDIR /app
COPY ./common-files common-files
COPY ./config/default.js config/default.js

RUN mkdir /mongodb

COPY ./core/client/src src
COPY ./core/client/entrypoint.sh ./core/client/package*.json ./

EXPOSE 27017
EXPOSE 80

RUN npm i
RUN npm link /app/common-files --save

ENTRYPOINT ["/app/entrypoint.sh"]
