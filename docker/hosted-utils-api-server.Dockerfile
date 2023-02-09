FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y md5deep

WORKDIR /app

COPY hosted-utils-api-server/src src
COPY hosted-utils-api-server/package.json hosted-utils-api-server/package-lock.json ./
COPY hosted-utils-api-server/entrypoint.sh entrypoint.sh

RUN npm ci

EXPOSE 80 9229

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["npm", "start"]
