#! /bin/bash

CONTAINER_ID=$(docker ps | grep worker | awk '{print $1}')
DST_FOLDER=src/zokrates
SRC_FOLDER=/app/output

DEPOSIT=deposit_stub
DOUBLE_TRANSFER=double_transfer_stub
SINGLE_TRANSFER=single_transfer_stub
WITHDRAW=withdraw_stub

# Copy Keys
docker cp ${CONTAINER_ID}:/${SRC_FOLDER}/${DEPOSIT}/${DEPOSIT}_pk.key ${DST_FOLDER}/${DEPOSIT}/keypair/${DEPOSIT}_pk.key
docker cp ${CONTAINER_ID}:/${SRC_FOLDER}/${DOUBLE_TRANSFER}/${DOUBLE_TRANSFER}_pk.key ${DST_FOLDER}/${DOUBLE_TRANSFER}/keypair/${DOUBLE_TRANSFER}_pk.key
docker cp ${CONTAINER_ID}:/${SRC_FOLDER}/${SINGLE_TRANSFER}/${SINGLE_TRANSFER}_pk.key ${DST_FOLDER}/${SINGLE_TRANSFER}/keypair/${SINGLE_TRANSFER}_pk.key
docker cp ${CONTAINER_ID}:/${SRC_FOLDER}/${WITHDRAW}/${WITHDRAW}_pk.key ${DST_FOLDER}/${WITHDRAW}/keypair/${WITHDRAW}_pk.key
