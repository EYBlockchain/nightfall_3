# Running a Nightfall node

This document describes how to deploy a Nightfall node to interact with a deployed nightfall instance. It's a simple deployment, designed to be run on your local machine and run up with docker-compose but it is straightforward to adapt it to a more production-grade environment; so long as you can run up containers and support volumes, you should be good. Generally nightfall containers can be restarted without issue and will sync themselves to the blockchain.  Only your commitment database requires careful handling because, if its contents are lost, you will be unable to prove ownership of any tokens that you deposited into layer 2 (althought you can protect against that by doing a transfer to yourself after a deposit to layer 2).

## Preliminaries

[ ] Clone the [nightfall_3](https://github.com/EYBlockchain/nightfall_3) repository.

### Blockchain node

[ ] Ensure you can connect to a synchronised blockchain node, exposing a websocket or http port, connected to the chain onto which you wish to run your nightfall node. One way to do this, if you have Geth installed, is with `geth attach <ws | http>://<host>:<port>`. This is required so that the Nightfall node can communicate with the blockchain.

[ ] Check that the chain Id is correct.  If you are attached with Geth you can do `net.version` it should be 80001 for Mumbai and 137 for Polygon PoS.

## Configuration

This configuration assumes that you will run a full Nightfall node with a Proposer and a Challenger (see how_it_works.md in the nightfall `doc` folder if these terms are unfamiliar to you) so that you can create layer 2 blocks and also challenge incorrect blocks.  The full node also contains a Nightfall Client so that you can create your own transactions. Provided there are enough independent Proposer and Challenger nodes that you aren't worried about possible censorship of your transactions, you only actually need to run a Client. For now, though, we'll create a full Nightfall node.

### Generate a fresh key pair for the Nightfall node

[ ] Nightfall is designed to be agnostic about how its transactions get signed. It simply returns a raw Ethereum transaction for signature and expects it to be signed and passed into the blockchain. This is so that security of the Ethereum private key can be managed according to local requirements (e.g. storage in an HSM). For test purposes however, Nightfall provides basic applications that can sign transactions and pass them into the blockchain (the Proposer, Challenger and User applications). These applications require access to an Ethereum private key so that they can sign transactions. This key will be exposed on the host and therefore should not be used for anything else, and should be generated specifically for this use. The easiest way to generate a private key and address is to use Metamask, generate a new account and export the private key.

### Set Environment variables

Set:

[ ] `USE_EXTERNAL_NODE=true` This will stop the containers waiting for a blockchain node to start.
[ ] `ETH_PRIVATE_KEY` with the private key of the account which is to sign the Nightfall node's transactions. Do NOT place `0x` at the begining of the key string. Do not use this account for anything else because this appoach is not fully secure.
[ ] `BLOCKCHAIN_URL` to equal the blockchain node RPC port that you are using (as above).
[ ] `NF_SERVICES_TO_START='worker, client, optimist'`.
[ ] `ENVIRONMENT`. The name that you are giving the deployment environment (as described in the ENVIRONMENTS object in `config/default.js`). For the Mumbai testnet, this variable should be set to `mumbai`.
[ ] Ensure that the account has sufficient funds. For the testnet, the amount that a Proposer has to pay to register is set to 1 Wei, so that actual amount has to be enough to propose a reasonable number of blocks (~100kGas/block). 10 Matic/ETH should be plenty for the testnet.

### Set config items

[ ] The `ENVIRONMENTS` object needs to be set for your deployment.  There should be an `ENVIRONMENTS` object that matches the name of the deployment `ENVIRONMENT` variable (e.g. 'mumbai'). Set the URLs so that the various Nightfall containers can find each other. If they are running on `localhost` then the values given in 'localhost' can be used. You have the option either to edit an existing object or to add your own.

## Create volumes for build and trusted setup artifacts

The Nightfall node requires the ABIs and addresses of the smart contracts that are deployed (including Openzeppelin Upgrade data, although the deployments are fully decentralised, so upgradability is in fact disabled). It also requires the reference strings from the trusted setup. These are available as a set of folders in a tar [archive](https://github.com/EYBlockchain/nightfall-artifacts) for the Mumbai deployment. Others will be availlable soon. The following assumes you are using the Mumbai artifacts but it's straightforward to addapt it for other chains.

[ ] Download the `mumbai.tar.gz` tar archive into the nightfall root directory and unpack it.

```sh
tar xzvf mumbai.tar.gz
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

### Build the containers

We include a build step so that we are not dependent on any local bind mount.  This makes the deploy a little more reproducible.

[ ] Run `bin/setup-nightfall`

### Deploy the Nightfall node

[ ] Run `bin/start-nightfall -n` *NB: do not use the `-g -d` arguments that you may be habituated with*. Doing so will remove the volumes that you have created.

### Deploy basic Proposer and Challenger applications

These can be run from another terminal window because the terminal used to deploy the Nightfall node is used for log output.

[ ] Set the `ENVIROMENT` environment variable as above (and to the same value)
[ ] Set the `PROPOSER_KEY` and `CHALLENGER_KEY` environent variables separately if you want to use different accounts from `ETH_PRIVATE_KEY`, otherwise just set `ETH_PRIVATE_KEY` (the value can be different from the one used for deployment), and that will be used by the Proposer and Challenger applications by default.
[ ] Set the `BLOCKCHAIN_URL` environment variable as above (and to the same value).
[ ] Run `bin/start-apps`.

You now have a complete nightfall node running. The `Nf3` class is the simplest way to interact with it from a user application.
