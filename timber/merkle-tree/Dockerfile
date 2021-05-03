FROM node:11.15

WORKDIR /app

COPY ./package.json ./package-lock.json ./
COPY ./src ./src
COPY ./test ./test
COPY ./.babelrc ./
COPY ./config ./config/

RUN npm ci

EXPOSE 80
CMD npm start
