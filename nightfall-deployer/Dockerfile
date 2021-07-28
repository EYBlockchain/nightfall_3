FROM node:14.17

WORKDIR /common-files
RUN echo "{\"name\": \"common-files\"}" > package.json

WORKDIR /app
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY package.json pre-start-script.sh package-lock.json ./
COPY src src
COPY contracts contracts
COPY migrations migrations
COPY truffle-config.js truffle-config.js
COPY circuits circuits
COPY entrypoint.sh entrypoint.sh
RUN chmod +x entrypoint.sh
RUN npm ci
ENTRYPOINT ["./entrypoint.sh"]
