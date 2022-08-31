FROM node:14.17

RUN apt-get update -y
RUN apt-get install -y md5deep

WORKDIR /app

COPY src src
COPY package.json package-lock.json ./
COPY entrypoint.sh entrypoint.sh

RUN npm ci

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["npm", "start"]
