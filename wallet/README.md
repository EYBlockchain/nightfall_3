# Wallet

### Running the Wallet locally

1. Install dependencies `npm ci`

2. Local development uses the ERC20Mock token deployed by `nightfall-deployer`. To make changes to
   the tokens used in the wallet for local development, look at
   `src/static/supported-token-list/supported-tokens-testnet.ts`

3. Start nightfall in development mode `cd ..` `./bin/start-nightfall -g -d`

4. Start the wallet in local development mode. `npm run start`

5. Ensure that your account used in metamask has the same tokens as supported by the wallet (See 2);

6. It is usually good practice to reset your local browser state between runs.

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
