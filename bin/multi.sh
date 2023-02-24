#!/bin/bash

for i in `seq 1 10`; do
    echo $i
    npm run test-erc20-tokens || exit 1;
done