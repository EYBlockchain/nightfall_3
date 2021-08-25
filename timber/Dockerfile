FROM node:14.17

WORKDIR /app
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY ./package.json ./package-lock.json ./
COPY ./src ./src
COPY entrypoint.sh entrypoint.sh

RUN npm ci

EXPOSE 80
ENTRYPOINT ["./entrypoint.sh"]