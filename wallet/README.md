# Wallet

### Running the Wallet locally

1. Install dependencies `npm ci`

2. Local development uses the ERC20Mock token deployed by `nightfall-deployer`. To make changes to
   the tokens used in the wallet for local development, look at
   `src/static/supported-token-list/supported-tokens-local.ts`

3. Start nightfall in development mode `cd ..` `./bin/start-nightfall -g -d`

4. Start the wallet in local development mode. `npm run start`

5. Ensure that your account used in metamask has the same tokens as supported by the wallet (See 2);

6. It is usually good practice to reset your local browser state between runs.

### Running the Wallet locally with AWS infrastructure

1. Copy wallet/template.copy.env to config file .xxx.env and fill the required `PROPOSER_API_URL`  and `PROPOSER_WS_URL` with
the proposer URL and the proposer websocket URL respectively.

2. Add new environment to `ChainIdMapping`. Open `wallet/src/common-files/utils/web3.js` and 
add new environment to `ChainIdMapping`. Include correct `chainId`. For `chainName`, set `Mainnet` if 
Nightfall is deployed in a mainnet, `Ganache` is its deployed to an internal network and `Testnet` if its 
deployed to a public testnet.

3. To make changes to the tokens used in the wallet, look at
   `src/static/supported-token-list/supported-tokens-testnet.ts` or
   `src/static/supported-token-list/supported-tokens-mainnet.ts`

4. Install dependencies `npm ci`

5. Start the wallet in local development mode. `ENV_NAME=xxx npm run start:env`, where `xxx`is the name of the env config file created 
in previous step (without .env extension). For example, if config env file is named `.testnet.env`, wallet is started with `ENV_NAME=testnet npm run start:env`.

6. Ensure that your account used in metamask has the same tokens as supported by the wallet (See 2);

7. It is usually good practice to reset your local browser state between runs.

### Resetting Local Browser State

#### **Reset Browser DBs**

The browser db is persistent between runs and not clearing them will cause untold issues.

- Open developer console in the browser.
- Navigate to the Application tab
- In the left hand column, under storage, select IndexedDB.
- Click on Nightfall Commitments and delete the database.
- Click on local storage in the same column.
- Right click on the localhost:3000 entry and click on Clear.

#### **Reset Metamask**

Metamask nonces will be persistent between runs not resetting them will cause untold issues.

- Go to Metamask > Settings > Advanced > Reset Account.
