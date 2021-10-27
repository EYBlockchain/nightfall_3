# nightfall_3

## Overview

*Please note that this is experimental software and is still undergoing development.  It should not be used to transfer items of material value*

Nightfall_3 is an application for transferring ERC20, ERC721 and ERC1155 applications under Zero Knowledge.  It abstracts away any need to deal directly with ZKP artefacts and provides a simple token-transfer API.  When used correctly, it will hide the recipient and the token being transferred.

Nightfall_3 uses optimistic rollups to counter the high gas costs of direct ZKP transactions. It can complete a ZKP transfer for approximately 10 kGas.  This compares with 700 kGas for the original Nightfall application. As a Layer 2 solution with on-chain data availability, Nightfall_3 can perform a private transfer for less than half the cost of a public ERCx transfer whilst maintaining the security and consensus assumptions from the Ethereum Mainnet.

## Setup

### Prerequisites

This application runs in docker containers so you will need Docker installed and you must allocate 14 GB of RAM and 4 GB of swap to the Docker containers.  Most problems are caused by the containers not having access to enough memory.  We also recommend allocating at least 4 cores to Docker if you are running in a virtual linux environment (e.g. on a Mac).

You will need a local copy of `node` and `npm` to run the tests and `git` to clone the repository.  We have tested with versions 14.15.1 and 6.14.13 of `node` and `npm`, respectively.

The application will run happily on a MacBook pro and most Linux implementations but Windows isn't supported. The code is in the process of being combined into a monorepo, so there may be a few code repetitions.  We'll get to those soon but they don't affect functionality.

### To setup the application

Clone this GitHub repository, then `cd` into it:

You need to run a setup script the first time that you use nightfall_3.  This will install all of the dependencies.

```sh
./setup-nightfall
```

### To start the application

If running for first time, do the setup as above and then run this script:
```sh
./start-nightfall -l | -g [-s]
```
This will bring up the application.  You can run it either with a Ganache blockchain simulator or a real blockchain client which exposes a websocket connection on localHost:8546.  See below for more details on how to do the latter as there are some additional considerations.  Use -g for Ganache and -l for localhost.  We recommend using Ganache first to check everything works, because it's considerably faster.  Additionally, you can use the -s flag.  If you do that, Nightfall_3 will run with stubbed ZKP circuits, which generate proofs that always verify.  That's useful for development work because tests will run much faster but clearly you should run without stubs, as a final check.

Startup will take a minute or so, depending on your machine. You'll see lots of warnings as it runs up from the `optimist` and `timber` containers.  That's entirely fine, they're just waiting for the other services that they need to start up. You should see no errors however.  If you do, something has broken.

Note that during compilation of the Solidity (part of the startup), you will receive one compiler warning.  This is because we read calldata directly via `msg.data` when a block is proposed, in the interests of Gas efficiency. As a result, the compiler thinks were not using one of our function parameters.  We've been unable to think of a good workaround as yet.

Eventually you will see a message to the effect that the `deployer` container has exited with code 0.  
```sh
nightfall_3_deployer_1 exited with code 0
```
This means that deployment is complete and the application is ready to use.  You can run the tests at this point.

## Testing

Open a separate terminal window, cd to the nightfall_3 repo and run
```sh
npm test
```
This will test the application, creating transactions and assembling them into layer 2 blocks.  By default the application is configured to put only two transactions into a layer 2 block.  This is to make the standard tests fast.  

### Measuring Block Gas used

In reality, a value of two transactions per block, although convenient for testing, wouldn't make very efficient use of Optimism.  A more realistic value is 32 transactions per layer 2 block. This value can be configured by the environment variable `TRANSACTIONS_PER_BLOCK` in the `docker-compose.yml` file (part of the `optimist` service). This is important for the Block Gas measurement, which requires a value of 32 to be set.

To measure the Block Gas used per transaction, first edit the `TRANSACTIONS_PER_BLOCK` variable as above (don't forget to change it back after), restart nightfall_3, and run:
```sh
npm run test-gas
```

### Test chain reorganisations

In Layer 2 solutions, Layer 2 state is held off-chain but created by a series of Layer 1 transactions (e.g. the proposal of a Layer 2 block).  In the case of Nightfall_3 these Layer 2 state updates are signalled by blockchain Events being 'broadcast'.  Thus, all Layer 2 solutions must be able to correct their Layer 2 state when it becomes invalidated by a Layer 1 chain reorganisation.  This is actually quite hard to test because it requires one to be able to generate a chain reorganisation to order.
To facilitate such a test, we create a private Geth-based blockchain (details of how to run this up are below) consisting of two clients, two miners and a bootnode.  We can then freeze half of the nodes by pausing their containers and creating transaction on the un-paused nodes to create a 'split-brain'.  Inverting the process to put different transactions on the other part of the network will create a chain fork and, when all the nodes are brought back on line, a chain reorganisation will occur.  Currently test coverage is fairly limited because there are a number of sub-classes of chain fork that have to be simulated. We continue to work on these.  These tests are run, once the private Geth blockchain is started, with:

```sh
npm test-chain-reorg
```

## Using a Geth private blockchain

The script `./geth-standalone` will run up a private blockchain consisting of a bootnode, two client nodes and two miners.  This is required for testing chain reorganisations (Ganache does not simulate a chain-reorg) but can be used for other tests or general running.  It's slower than using Ganache but it does provide a more real-life test. Note also that the private chain exposes a client on `host.docker.internal:8546`.  On a Mac this will map to `localhost` but it won't work on any other machine. If you aren't on a Mac then edit `nightfall-deployer/truffle-config.js` to point to the IP of your `localhost` or use the docker-compose line `external_servers` to inject a hostname into the containers host file (see the Github workflows for further clues about how to do that).

To use the private blockchain:

- Run up the private chain with `./geth-standalone -s`
- Start terminal logging with `./geth-standalone -l` and wait for the DAG build to complete
- Start Nightfall in another terminal with the `-l` option (`./start-nightfall -l`) and, optionally, the `-s` option if you want stubbed circuits.

That's it.  You can shut down the geth blockchain with `./geth-standalone -d` or pause/unpause it with `-p`, `-u`.

## Software Development Kit

Nightfall_3 provides an SDK which makes it easy to develop applications that use Nightfall_3.  The SDK API is documented in `./doc/lib/Nf3.html` and is provided by the NF_3 class `./cli/lib/nf3.mjs`.

## Command line interface

Nightfall_3 provides a CLI (which makes use of the SDK) so that you can exercise its features.  To use it:
- run up nightfall_3 as described above and wait for the deployment to complete;
- open another terminal and type `./proposer`.  This will start a small application running which will sign block proposal transactions;
- open up a third terminal and type `./nf`.  This will start the CLI. It should be fairly self explanatory but be mindful that you can only use the output of previous transactions once they have been incorporated in a Layer 2 block - for example you need you at least two deposits to be able to do a transfer because by default two deposits is the minimum needed to fill a block.
- You can also run a Challenge signer if you wish (`./challenger`) but it is of limited use because NF_3 will reject locally-created invalid transactions and so you will never get to the stage of something challengeable making it on chain.

## Wallet
Nightfall_3 provides a Wallet to exercise its features. To use it:

- Generate browser version of SDK:
```
cd cli
npm install
npm run build
```
- Deploy nightfall (only ganache for now) from Nightfall's root folder
```
./start-nightfall -g -s
```
- In a different terminal, start proposer from Nightfall's root folder once Nightfall deployment is finished
(you will see this `nightfall_3-deployer-1 exited with code 0`).

```
./proposer
```

- In a different terminal, start the liquitidy provider from Nightfall's root folder. Liquidity provider is needed to use `instant withdraw` feature
```
./liquidity-provider
```

- Launch wallet.
```
cd wallet
npm install
npm start
```

- When the wallet starts, you will have the option to enter your private key on connecting with metamask wallet installed in your browser. If you select the latter, you need to have previously configured your metamask wallet to operate with Nightfall's deployment on localhost

### Configuring Metamask to work with Nightfall on localhost
1. Open Metamask wallet
2. Import Account and paste the private key. While we are working on localhost, we will be using a test account with private key `0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e`
3. Next step is to configure Nightfall's RPC network. Go to `Settings->Networks->Add Network`
4. Enter the following information and press `Savle`
- `Network Name` : nightfall-localhost
- `New RPC URL` : http://localhost:8546
- `Chain ID`: 1337
5. Select the new imported account and the new created network



### Limitations
- You cannot run the wallet and a separate version of the SDK (CLI for example) in parallel as nonces will get mixed.
- If you select Metamask as your wallet, you need to reset the nonce every time you restart Nightfall, as Metamask will keep previous nonce whereas ganache has reset it. If nonce is not reset, you will see an error message after signing the transaction. To reset the nonce in metamask:
1. Open Metamask in browser
2. Settings->Advance->Reset Account

- Initial balances shown by the wallet are fake. 
- Tokens have been configured with a constant number of 9 decimals in the wallet. On the other hand, the mock token contracts do not have decimals implemented. So, there will be inconsistencies in the L1 vs L2 balance (you can deposit more tokens to L2 than what's available in L1). For testing purposes it is not a problem.
- Direct transactions are not implemented
- Instant withdraw is selected when doing a withdraw only. Once submitted the instant withdraw request,the wallet requests a simple withdraw and inmediatelly after converts this withdraw into an instant withdraw. Wallet will attempt to send the instant withdraw request up to 10 times, once every 10 seconds. It is likely that during this period, you need to request a simpler transaction (deposit, withdraw or transfer) so that the original withdraw is processed by the processor and the instant withdraw can be carried out.
- Tested with node version v14.18.0

# Acknowledgements

We gratefully acknowledge the inspiration of the Ethereum Foundation and, particularly, Barry Whitehat and Wanseob Lim and their [zkopru](https://ethresear.ch/t/zkopru-zk-optimistic-rollup-for-private-transactions/7717) application.

We make use of the [ZoKrates](https://zokrates.github.io/) compiler, which removes much of the hard work of developing ZKP circuits.

We hope that we have credited everyone who contributed significantly to this project but please let us know if we have missed you out and we'll add you here!
