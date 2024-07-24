FROM node:16.17-bullseye-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    md5deep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY hosted-utils-api-server/src src
COPY hosted-utils-api-server/package.json hosted-utils-api-server/package-lock.json ./
COPY hosted-utils-api-server/entrypoint.sh entrypoint.sh

RUN npm ci

EXPOSE 80 9229

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["npm", "start"]
