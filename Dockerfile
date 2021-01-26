FROM node:14.15

# install netcat
RUN apt-get update
RUN apt-get install -y netcat

WORKDIR /app

COPY src src
COPY config config
COPY docker-entrypoint.sh package.json package-lock.json ./
RUN chmod 755 docker-entrypoint.sh

RUN npm ci

EXPOSE 80

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
