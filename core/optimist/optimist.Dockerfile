# build zokrates from source for local verify
FROM ghcr.io/eyblockchain/local-zokrates as builder

FROM mongo:focal
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

WORKDIR /app
COPY ./common-files common-files
COPY ./config/default.js config/default.js


COPY ./core/optimist/src src
COPY ./core/optimist/entrypoint.sh ./core/optimist/package*.json ./
COPY --from=builder /app/ZoKrates/zokrates_stdlib/stdlib /root/.zokrates/stdlib
COPY --from=builder /app/ZoKrates/target/release/zokrates /app/

RUN mkdir mongodb

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

RUN npm i
RUN npm link /app/common-files --save

EXPOSE 80
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
