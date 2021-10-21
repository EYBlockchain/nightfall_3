# Nightfall Wallet

## Requirements
- node v14.18.0+
## Start wallet:

1. Generate browser version of SDK:
```
cd cli
npm install
npm run build
```
2. Deploy nightfall (only ganache for now) from Nightfall's root folder
```
./start-nightfall -g -s
```
3. Start proposer from Nightfall's root folder once Nightfall deployment is finished
(you will see this `nightfall_3-deployer-1 exited with code 0`).

```
./proposer
```
4. Launch wallet.
```
cd wallet
npm install
npm start
```
