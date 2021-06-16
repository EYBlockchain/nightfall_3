ARG GPR_TOKEN

FROM zokrates/zokrates:0.6.3 as builder

FROM node:14.17 as node-build
ARG GPR_TOKEN
WORKDIR /app
COPY ./package.json ./package-lock.json ./.npmrc ./

RUN npm ci
RUN rm -f .npmrc

FROM node:14.17
WORKDIR /app

COPY --from=node-build /app /app
COPY --from=builder /home/zokrates/.zokrates/bin/zokrates /app/zokrates
COPY ./stdlib-bugfix/stdlib /app/stdlib/
COPY ./src ./src
COPY ./circuits ./circuits

RUN apt-get update -y
RUN apt-get install -y netcat

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

EXPOSE 80
CMD npm start
