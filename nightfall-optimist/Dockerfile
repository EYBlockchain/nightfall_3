FROM mongo:4.4.1-bionic

# install node
RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y netcat

WORKDIR /app
RUN mkdir /app/mongodb

COPY src src
COPY docker-entrypoint.sh package.json package-lock.json ./
RUN chmod 755 docker-entrypoint.sh

RUN npm ci

EXPOSE 80

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
