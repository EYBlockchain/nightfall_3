FROM zokrates/zokrates:0.6.1 as builder

FROM node:14.11.0

RUN mkdir /app
WORKDIR /app

ARG NPM_TOKEN

COPY --from=builder /home/zokrates/.zokrates/bin/zokrates /app/zokrates
COPY ./stdlib-bugfix/stdlib /app/stdlib/
COPY ./src ./src
COPY ./circuits ./circuits
COPY ./config ./config
COPY ./package.json ./package-lock.json ./.npmrc ./

COPY ./start-script ./start-script
COPY ./start-dev ./start-dev

RUN npm ci
RUN rm -f .npmrc

RUN apt-get update -y
RUN apt-get install -y netcat

ENV ZOKRATES_HOME /app/stdlib

EXPOSE 80
CMD npm start
