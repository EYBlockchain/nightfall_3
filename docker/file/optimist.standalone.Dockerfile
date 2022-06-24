# install zokrates for local verify
FROM zokrates/zokrates:0.7.7 as builder

FROM node:14.17
# install node
RUN apt-get update

# TEMPORARY WORKAROUND FOR ISSUE https://github.com/nodesource/distributions/issues/1266
RUN apt-get install -y ca-certificates

RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs gcc g++ make
RUN apt-get install -y netcat
# installs libs required for zokrates
RUN apt-get install -y libgmpxx4ldbl libgmp3-dev

WORKDIR /
COPY common-files common-files
COPY config/default.js app/config/default.js

WORKDIR /app
RUN mkdir /app/mongodb

COPY nightfall-optimist/src src
COPY nightfall-optimist/docker-entrypoint.standalone.sh ./docker-entrypoint.sh
COPY nightfall-optimist/pre-start-script.sh nightfall-optimist/package*.json  ./
COPY --from=builder /home/zokrates/.zokrates/bin/zokrates /app/zokrates
COPY --from=builder /home/zokrates/.zokrates/stdlib /app/stdlib/

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

RUN npm ci

ARG OPTIMIST_PORT=80
ARG OPTIMIST_WS_PORT=8080

EXPOSE ${OPTIMIST_PORT}

# websocket port 8080
EXPOSE ${OPTIMIST_WS_PORT}

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]