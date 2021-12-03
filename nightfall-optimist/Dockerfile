# install zokrates for local verify
FROM zokrates/zokrates:0.6.4 as builder
FROM mongo:4.4.1-bionic

# install node
RUN apt-get update

# TEMPORARY WORKAROUND FOR ISSUE https://github.com/nodesource/distributions/issues/1266
RUN apt-get install -y ca-certificates

RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y netcat
# installs libs required for zokrates
RUN apt-get install -y libgmpxx4ldbl libgmp3-dev

WORKDIR /common-files
RUN echo "{\"name\": \"common-files\"}" > package.json

WORKDIR /app
RUN mkdir /app/mongodb

COPY --from=builder /home/zokrates/.zokrates/bin/zokrates /app/zokrates
COPY --from=builder /home/zokrates/.zokrates/stdlib /app/stdlib/

ENV ZOKRATES_HOME /app
ENV ZOKRATES_STDLIB /app/stdlib

COPY src src
COPY docker-entrypoint.sh pre-start-script.sh package.json package-lock.json ./

RUN npm ci

EXPOSE 80

# websocket port 8080
EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["npm", "start"]
