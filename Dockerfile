FROM node:14.11.0

WORKDIR /app

COPY src src
COPY package.json package-lock.json ./

RUN npm ci

CMD ["npm", "start"]
