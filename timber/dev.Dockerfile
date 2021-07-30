FROM node:14.17

WORKDIR /app

COPY ./package.json ./package-lock.json ./.npmrc ./
COPY ./src ./src
# ARG GPR_TOKEN
RUN npm ci
RUN rm -f .npmrc

EXPOSE 80
CMD npm run dev
