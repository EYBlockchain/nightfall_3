FROM node:16.17 as rapidsnark

RUN apt-get update -y
RUN apt-get install -y build-essential netcat git libgmp-dev libsodium-dev nasm \
      && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Rapidsnark
RUN git clone https://github.com/iden3/rapidsnark.git

WORKDIR /app/rapidsnark

RUN npm install

RUN git submodule init
RUN git submodule update

RUN npx task createFieldSources
RUN npx task buildProver
