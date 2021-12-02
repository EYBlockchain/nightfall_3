#! /bin/bash

## Usage
# ./nf [OPTIONAL ARGUMENTS]
# OPTIONAL_ARGUMENTS:
#  --environment : test environment (such us localhost, docker, testnet). If no argument given
#     nf is launched in localhost environment

/usr/bin/env node cli/src/index.mjs "${@:1}"
