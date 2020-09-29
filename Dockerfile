FROM zokrates/zokrates:0.6.1 as builder

FROM node:14.11.0

RUN mkdir /app
WORKDIR /app

COPY --from=builder /home/zokrates/.zokrates/bin/zokrates /app/zokrates
COPY ./stdlib-bugfix/stdlib /app/stdlib/
COPY ./src ./src
COPY ./circuits ./circuits
COPY ./package.json ./
# Note: we copy the node modules in directly because otherwise we'd need to
# give the Dockerfile github credentials, which isn't great.
COPY ./node_modules ./node_modules
COPY ./start-script ./start-script
COPY ./start-dev ./start-dev

RUN apt-get update -y
RUN apt-get install -y netcat

ENV ZOKRATES_HOME /app/stdlib

EXPOSE 80
CMD npm start
