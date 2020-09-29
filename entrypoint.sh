#! /bin/bash
npx truffle migrate --network=${ETH_NETWORK:=openethereum}

sleep 10 

npm start
