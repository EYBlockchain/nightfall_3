FROM node:16.17 as rapidsnark

RUN apt-get update -y
RUN apt-get install -y netcat
RUN apt-get install -y git

WORKDIR /app

# Rapidsnark
RUN git clone https://github.com/iden3/rapidsnark.git

WORKDIR /app/rapidsnark
# For Mac Silicon this will default to aarch64-unknown-linux-gnu
RUN apt install -y build-essential
RUN apt-get install -y libgmp-dev
RUN apt-get install -y libsodium-dev
RUN apt-get install -y nasm
RUN npm install
RUN git submodule init
RUN git submodule update
RUN npx task createFieldSources
RUN npx task buildProver
