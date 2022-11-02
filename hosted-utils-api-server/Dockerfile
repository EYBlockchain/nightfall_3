FROM node:16.17

RUN apt-get update -y
RUN apt-get install -y md5deep

WORKDIR /app

COPY src src
COPY package.json package-lock.json ./
COPY entrypoint.sh entrypoint.sh

RUN npm ci

EXPOSE 80 9229

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["npm", "start"]
