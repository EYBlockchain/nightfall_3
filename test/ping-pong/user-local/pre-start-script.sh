#!/usr/bin/env bash

DIR=../../../common-files/node_modules
if [[ -d "$DIR" ]]; then
  rm -dr ../../../common-files/node_modules
fi

rm ./node_modules/common-files
cp -R ../../../common-files ./node_modules
