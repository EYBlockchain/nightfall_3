# Wallet

## Testing ERC Contracts
For testing purposes, account `0x9C8B2276D490141Ae1440Da660E470E7C0349C63` with privateKey `0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e` has been setup in testnet wit some Ether and some ERC tokens.

## How is nightfall's mnemonic stored?
When connecting with Metamask to your nightfall account for the first time, you will be prompted to enter a twelve word
mnemonic. This mnemonic is used by nightfall to generate your personal set of keys that will allow you to operate on nighrfall.
You need to save this 12 word seed in a safe place, as it is the only way to recover your nightfall account.
This wallet offers a backup, but this backup is only a convenient way to log in to your account without entering the mnemonic, and
must no be relied to provide a permanent backup.
If you select to backup your nightfall mnemonic, it will be encrypted in local storage using as a key the result of hashing as signed message via Metamask. When logging back, you will be request to sign a message to decript the mnemonic and unlock your metamask account.

## How to generate different keys from a single mnemonic?
When you login to nightfall, you will be using account index 0. You can select a different index in `Account Settings` to use a different set of keys.

## Tests
*Updates : E2E test is not working, not maintained currently*
To launch test, set these `NETWORK_NAME`, `RPC_URL`, `CHAIN_ID`, and `PRIVATE_KEY` environment variable in local machine and then run
```sh
npm run e2e-test
```
### For example
If launching test (e2e test) locally with Ganache.
  1. Follow instruction [here](https://github.com/EYBlockchain/nightfall_3#wallet) to start wallet app with ganache.
  2. Run `e2e-test` npm script in wallet director `NETWORK_NAME=ganache-nightfall RPC_URL=http://localhost:8546 CHAIN_ID=1337 PRIVATE_KEY=0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e npm run e2e-test`
