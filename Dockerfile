FROM node:12.18
WORKDIR /app
COPY package.json package-lock.json ./
COPY config config
COPY src src
COPY contracts contracts
COPY migrations migrations
COPY truffle-config.js truffle-config.js
COPY circuits circuits
COPY entrypoint.sh entrypoint.sh
RUN chmod +x entrypoint.sh
RUN npm ci
ENTRYPOINT ["./entrypoint.sh"]
