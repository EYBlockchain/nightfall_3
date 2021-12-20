FROM zokrates/zokrates:0.7.7 as builder

FROM node:14.17

WORKDIR /app

COPY config/default.js config/default.js
COPY /nightfall-deployer/circuits circuits
COPY ./zokrates-worker/package.json ./zokrates-worker/package-lock.json ./
COPY --from=builder /home/zokrates/.zokrates/bin/zokrates /app/zokrates
COPY --from=builder /home/zokrates/.zokrates/stdlib /app/stdlib/
COPY ./zokrates-worker/src ./src
COPY ./zokrates-worker/circuits ./circuits
COPY ./zokrates-worker/start-script ./start-script
COPY ./zokrates-worker/start-dev ./start-dev

RUN apt-get update -y
RUN apt-get install -y netcat

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

RUN npm ci

EXPOSE 80
CMD npm start
