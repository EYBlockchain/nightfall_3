FROM docker.pkg.github.com/eyblockchain/zokrates-zexe/zokrates_zexe:a6bfd3bf3fa81fc4b4ced9d6b4a998cb240b21fe as builder

FROM node:12.18.1

RUN mkdir /app
WORKDIR /app

COPY --from=builder /home/zokrates/zokrates /app/zokrates
COPY --from=builder /home/zokrates/.zokrates* /app/stdlib
COPY ./src ./src
COPY ./circuits ./circuits
COPY ./package.json ./
# Note: we copy the node modules in directly because otherwise we'd need to
# give the Dockerfile github credentials, which isn't great.
COPY ./node_modules ./node_modules
COPY ./start-script ./start-script

RUN apt-get update -y
RUN apt-get install -y netcat

EXPOSE 80
CMD npm start
