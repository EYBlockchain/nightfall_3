FROM node:14.17

WORKDIR /app

COPY src src
COPY package.json package-lock.json ./

RUN npm ci

CMD ["npm", "start"]
