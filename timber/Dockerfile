FROM node:14.17

WORKDIR /app
RUN apt-get update -y
RUN apt-get install -y netcat-openbsd
COPY ./package.json ./package-lock.json ./.npmrc ./
COPY ./src ./src
COPY entrypoint.sh entrypoint.sh
RUN chmod +x entrypoint.sh
# ARG GPR_TOKEN
RUN npm ci
RUN rm -f .npmrc

EXPOSE 80
ENTRYPOINT ["./entrypoint.sh"]