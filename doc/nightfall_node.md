# Running a Nightfall node

This document describes how to deploy a Nightfall node to interact with a deployed nightfall instance. It's a simple deployment, designed to be run on your local machine and run up with docker-compose but it is straightforward to adapt it to a more production-grade environment; so long as you can run up containers and support volumes, you should be good. Generally nightfall containers can be restarted without issue and will sync themselves to the blockchain.  Only your commitment database requires careful handling because, if its contents are lost, you will be unable to prove ownership of any tokens that you deposited into layer 2 (although you can protect against that by doing a transfer to yourself after a deposit to layer 2).

Although it's a fairly generic document, it focuses on running a node on the Polygon Mumbai testnet.

## Preliminaries

[ ] Clone the [nightfall_3](https://github.com/EYBlockchain/nightfall_3) repository.

### Blockchain node

[ ] Ensure you can connect to a synchronised blockchain node, exposing a websocket or http port, connected to the chain onto which you wish to run your nightfall node. One way to do this, if you have Geth installed, is with `geth attach <ws | http>://<host>:<port>`. This is required so that the Nightfall node can communicate with the blockchain.

[ ] Check that the chain Id is correct.  If you are attached with Geth you can do `net.version` it should be 80001 for Mumbai and 137 for Polygon PoS.

## Configuration

This configuration assumes that you will run a full Nightfall node with possibly an optional Proposer and a Challenger (see how_it_works.md in the nightfall `doc` folder if these terms are unfamiliar to you), so that you can create layer 2 blocks and also challenge incorrect blocks.  The full node also contains a Nightfall Client so that you can create your own transactions. Provided there are enough independent Proposer and Challenger nodes, running their own Optimist nodes so that you aren't worried about possible censorship of your transactions, you only actually need to run a Client. For now, though, we'll create a full Nightfall node.

### Generate a fresh key pair for the Nightfall node

[ ] Nightfall is designed to be agnostic about how its transactions get signed. It simply returns a raw Ethereum transaction for signature and expects it to be signed and passed into the blockchain. This is so that security of the Ethereum private key can be managed according to local requirements (e.g. storage in an HSM). For test purposes however, Nightfall provides basic applications that can sign transactions and pass them into the blockchain (the Proposer, Challenger and User applications). These applications require access to an Ethereum private key so that they can sign transactions. This key will be exposed on the host and therefore should not be used for anything else, and should be generated specifically for this use. The easiest way to generate a private key and address is to use Metamask, generate a new account and export the private key.

Note that to complete the tests, a second account is needed so you may wish to generate two private keys and fund the accounts with a small amount of matic.

### Set Environment variables

Note, there is a pre-populated script `bin/mumbai-node.env` for the Mumbai network to create all of the variables needed.  This saves having to set them individually and is less error-prone:

```sh
source bin/mumbai-node.env <my-private-key> <my-second-private-key> <blockchain node url>
```

`<my-private-key>` is the `ETH_PRIVATE_KEY` value (and `USER1`, `PROPOSER` - see later). It's passed in as an argument for security reasons. `<my-second-private-key>` is used for running tests (see later).  The `blockchain node url` is exactly that e.g. `ws://1.2.3.4:8546`.

If you are not using the `mumbai-node` script then export the following environment variables now:

[ ] `USE_EXTERNAL_NODE=true` This will stop the containers waiting for a deployer to start.

[ ] `ETH_PRIVATE_KEY` with the private key of the account which is to sign the Nightfall node's transactions. Do NOT place `0x` at the beginning of the key string. Do not use this account for anything else because this approach is not fully secure.

[ ] `BLOCKCHAIN_URL` to equal the blockchain node RPC port that you are using (as above).

[ ] `NF_SERVICES_TO_START='worker, client, optimist'`.

[ ] `ENVIRONMENT`. The name that you are giving the deployment environment (as described in the ENVIRONMENTS object in `config/default.js`). For the Mumbai testnet, this variable should be set to `mumbai`.

[ ] Ensure that the account has sufficient funds. For the testnet, the amount that a Proposer has to pay to register is set to 1 Wei, so that actual amount has to be enough to propose a reasonable number of blocks (~100kGas/block). 10 Matic/ETH should be plenty for the testnet.

### Set config items

If you are running in Mumbai, there is nothing to do in this section; it's all prepopulated for you in the config.

[ ] The `ENVIRONMENTS` object needs to be set for your deployment.  There should be an `ENVIRONMENTS` object that matches the name of the deployment `ENVIRONMENT` variable (e.g. 'mumbai'). Set the URLs so that the various Nightfall containers can find each other. If they are running on `localhost` then the values given in 'mumbai' can be used. You have the option either to edit an existing object or to add your own.

## Create volumes for build and trusted setup artifacts

The Nightfall node requires the ABIs and addresses of the smart contracts that are deployed (including Openzeppelin Upgrade data, although the deployments are fully decentralised, so upgradability is in fact disabled). It also requires the reference strings from the trusted setup. These are available as a set of folders in a tar [archive](https://github.com/EYBlockchain/nightfall-artifacts) for the Mumbai deployment. Others will be available soon. The following assumes you are using the Mumbai artifacts but it's straightforward to adapt it for other chains.

[ ] Download the `mumbai.tar.gz` tar archive into the nightfall root directory and unpack it.

```sh
tar xzvf mumbai.tar.gz
cd mumbai
ls -a
```

You should have three sub-directories: `build`, `proving_files` and `.openzeppelin` (you will need to do `ls -a` to see the latter). Make them into docker volumes, which the Nightfall node will read from:

[ ] Remove any existing volumes

```sh
docker volume rm nightfall_3_build
docker volume rm nightfall_3_proving_files
docker volume rm nightfall_3_.openzeppelin
```

If you get an error to the effect that there is no such volume, don't worry.  It just means you had no pre-existing ones.

[ ] create empty volumes

```sh
docker volume create nightfall_3_build
docker volume create nightfall_3_proving_files
docker volume create nightfall_3_.openzeppelin
```

[ ] Copy the downloaded data into the volumes

```sh
docker container create --name temp -v nightfall_3_build:/mnt busybox
docker cp mumbai/build/. temp:/mnt
docker rm temp
docker container create --name temp -v nightfall_3_proving_files:/mnt busybox
docker cp mumbai/proving_files/. temp:/mnt
docker rm temp
docker container create --name temp -v nightfall_3_.openzeppelin:/mnt busybox
docker cp mumbai/.openzeppelin/. temp:/mnt
docker rm temp
```

When the containers are started, they will mount these volumes and use the downloaded data to interact with the nighfall smart contracts and to compute zero knowledge proofs.

## Run the deployment

### Perform npm link

[ ] This will take on board any changes to common files folder, which is imported as a package.

```sh
cd common-files
npm link
cd ..
npm link @polygon-nightfall/common-files
cd cli
npm link @polygon-nightfall/common-files
cd ..
```

### Build the containers

We include a build step so that we are not dependent on any local bind mount.  This makes the deploy a little more reproducible.

[ ] Run `bin/setup-nightfall`

### Deploy the Nightfall node

[ ] Run `bin/start-nightfall -n` *NB: do not use the `-g -d` arguments that you may be habituated with*. Doing so will remove the volumes that you have created.

Note that when the containers start, they will begin to synchronise themselves with the Layer 2 on-chain data. This currently takes about 10 minutes but the time will increase as the size of the on-chain data grows. It's analogous to a conventional Blockchain node syncing. Once you see both Client and Optimist containers report that Queue 0 has been started, you are good to go. Do not attempt to make transactions while they are syncing as this is not a fully-tested situation.

### Deploy basic Proposer and Challenger applications (optional - not needed to run tests)

These can be run from another terminal window because the terminal used to deploy the Nightfall node is used for log output. They are not part of the nightfall node and you may well be using your own versions, in which case they are not required.  Note that the tests provide their own applications and thus you do not need to deploy these to run tests. There is no short-cut script for these environment variables, enter them manually or make your own script.

[ ] Set the `ENVIRONMENT` environment variable as above (and to the same value)
[ ] Set the `PROPOSER_KEY` and `CHALLENGER_KEY` environment variables separately if you want to use different accounts from `ETH_PRIVATE_KEY`, otherwise just set them to the same value as `ETH_PRIVATE_KEY` (the value can be different from the one used for deployment), and that will be used by the Proposer and Challenger applications by default.

[ ] Set the `BLOCKCHAIN_URL` environment variable as above (and to the same value).

[ ] Run `bin/start-apps`.

You now have a complete nightfall node running. The `Nf3` class is the simplest way to interact with it from a user application.

## Test the deployment (Mumbai only)

We will test the deployment using the erc20 and x509 tests, as these tests have been adapted to run on Mumbai as well as locally. The test does not require a Proposer and Challenger to run because the test scripts create their own, where needed. It does require working Optimist and Client containers though, so get them running, if you haven't already, and keep the logging window open. Note also that some tests require the blockchain to time-shift over the challenge period. Obviously this only works with a blockchain simulator, so these tests are automatically skipped.

### x509

The first thing we need to do is to whitelist our account by providing the correct x509 certificate to the x509 smart contract. The easiest way to do this is to run the x509 test. You are probably using a different terminal so first re-export the environment variables that you need:

```sh
source mumbai-node.env <my-private-key> <my-other-private-key>
```

Relevant at this stage is that the script has also set private keys for the test actors: `USER1_KEY`, `USER2_KEY` and `PROPOSER_KEY`; the `ETH_NETWORK` so that it can find contract addresses; and also the currency that we will deal in `ERC20_COIN=WMATIC`. Note that this coin must have been made available during deployment.  You are not free to use just any coin. The list of acceptable coins is in the `RESTRICTIONS` section of `config/default.js` under `mumbai:`.  The USER1_KEY and the USER2_KEY are set to the values provided as arguments `<my-private-key>` and  `<my-other-private-key>`.

Then we can run the x509 test:

```sh
npm run test-x509
```

Note that this test can be very slow to finish (~5 minutes). Don't assume it's hung. Please be patient. Improvements are being worked on.

### ERC20

Complete the previous test first, to activate whitelisting.

The erc20 test has four actors:

1. User 1
2. User 2
3. Proposer
4. Sanctioned User

The only new actor here is the Sanctioned User.  This user is on the sanctioned list for the mock Chainalysis sanctions list contract that will have been deployed to Mumbai as part of the deployment (Mumbai does not have a real version of the contract). We do not use this test however because that would require setting up a sanctioned user address to match that in the deployed contract. To skip it, we clear the `DEPLOY_MOCKED_SANCTIONS_CONTRACT` environment variable.

Note that you do need to set Ethereum private keys for the Proposer and users though. You can reuse the User 1 key for the Proposer but User 1 and User 2 need different keys. Unless you are using the `mumbai-node.env` script above, which will already have set these keys, you should export these environment variables now:

```sh
export USER1_KEY=<my-private-key>
export PROPOSER_KEY=$USER1_KEY
export USER2_KEY=<my-second-private-key>
```

Again, if not using `mumbai-node.env` you should tell the test which currency to use:

```sh
export ERC20_COIN=WMATIC
export FEE_L2_TOKEN_ID=WMATIC
```

[ ] The test can then be run against the deployed contracts:

```sh
npm run test-erc20-tokens
```

Note that these tests are very much integration tests and are stateful. They depend on a correct test sequence (you can't transfer a commitment that you haven't yet deposited).

If your tests begin to fail, the most likely cause is that your Client and/or Optimist has dropped out of sync with the blockchain. This can happen if the tests terminate unexpectedly or are stopped during execution. Restarting the Optimist and Client containers will let them re-sync using on-chain data, which is, by definition, the true state of the system.

The tests currently make the assumption that there is no other proposer running. If this is not the case it's possible that another proposer may post the test transactions. The tests listens for a block to be proposed before continuing and if another proposer does post the transactions before the test starts listening for the block proposal, there could be a race-condition failure. This is not known to be an issue but it is something to watch for.
