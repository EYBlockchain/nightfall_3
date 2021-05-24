FROM node:14.15.1
RUN npm install npm@^7.11 -g

WORKDIR /app

COPY ./package.json ./package-lock.json ./.npmrc ./
COPY ./src ./src
COPY ./test ./test
COPY ./.babelrc ./
COPY ./config ./config/
ARG GPR_TOKEN
RUN npm ci

EXPOSE 80
CMD npm start
