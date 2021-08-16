# nightfall_3

## Overview

*Please note that this is experimental software and is still undergoing development.  It should not be used to transfer items of material value*

Nightfall_3 is an application for transferring ERC20, ERC721 and ERC1155 applications under Zero Knowledge.  It abstracts away any need to deal directly with ZKP artefacts and provides a simple token-transfer API.  When used correctly, it will hide the recipient and the token being transferred.

Nightfall_3 uses optimistic rollups to counter the high gas costs of direct ZKP transactions. It can complete a ZKP transfer for approximately 10 kGas (this will soon be reduced to 8 kGas with a pending update).  This compares with 700 kGas for the original Nightfall application. As a Layer 2 solution with on-chain data availability, Nightfall_3 can perform a  private transfer for less than half the cost of a public ERCx transfer whilst maintaining the security and consensus assumptions from the Ethereum Mainnet.

## Setup

### Prerequisites

This application runs in docker containers so you will need Docker installed and you must allocate 14 GB of RAM and 4 GB of swap to the Docker containers.  Most problems are caused by the containers not having access to enough memory.  We also recommend allocating at least 4 cores to Docker.

You will need a local copy of `node` and `npm` to run the tests and `git` to clone the repository.  We have tested with versions 14.15.1 and 6.14.13 of `node` and `npm`, respectively.

The application will run happily on a MacBook pro and most Linux implementations but Windows isn't supported. The code is in the process of being combined into a monorepo, so there may be a few code repetitions.  We'll get to those soon but they don't affect functionality.

### To setup the application

Clone this GitHub repository, then `cd` into it:

You need to run a setup script the first time that you use nightfall_3.  This will install all of the dependencies. We use GitHub packages to store our NPM packages and so you will have to create a Personal Access [Token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token), to pull these. It's just the way GitHub works. Call it GPR_TOKEN:

```sh
export GPR_TOKEN=<my_personal_access_token_string>
```
You can put the above line in your `~/.bash_profile` file if you wish (and you are using bash!).

After that, run the setup script
```sh
./setup-nightfall
```

### To start the application

If running for first time, do the setup as above and then run this script:
```sh
./start-nightfall [-e | -g]
```
This will bring up the application.  You can run it either with a Ganache blockchain simulator or a real Geth private network.  Use -g for Ganache and -e for Geth.  We recommend using Ganache first to check everything works, because it's considerably faster. 

Startup will take a minute or so, depending on your machine. You'll see lots of warnings as it runs up from the `optimist` and `timber` containers.  That's entirely fine, they're just waiting for the other services that they need to start up. You should see no errors however.  If you do, something has broken.

Note that during compilation of the Solidity (part of the startup), you will receive one compiler warning.  This is because we read calldata directly via `msg.data` when a block is proposed, in the interests of Gas efficiency. As a result, the compiler thinks were not using one of our function parameters.  We've been unable to think of a good workaround as yet.

Eventually you will see a message to the effect that the `deployer` container has exited with code 0.  
```sh
nightfall_3_deployer_1 exited with code 0
```
This means that deployment is complete and the application is ready to use.  You can run the tests at this point.

### Testing

Open a separate terminal window, cd to the nightfall_3 repo and run
```sh
npm test
```
This will test the application, creating transactions and assembling them into layer 2 blocks.  By default the application is configured to put only two transactions into a layer 2 block.  This is to make the standard tests fast.  They won't currently run with any other value because they have to know when the application should have created a block in order to test it properly.  

### Measuring Block Gas used

In reality, a value of two transactions per block, although convenient for testing, wouldn't make very efficient use of Optimism.  A more realistic value is 32 transactions per layer 2 block. This value can be configured by the environment variable `TRANSACTIONS_PER_BLOCK` in the docker-compose.yml file (part of the `optimist` service). This is important for the Block Gas measurement, which requires a value of 32 to be set.

To measure the Block Gas used per transaction, first edit the `TRANSACTIONS_PER_BLOCK` variable as above (don't forget to change it back after), restart nightfall_3, and run:
```sh
npm run test-gas
```

### A note on the ZKP circuits

The computation of proofs associated with the transfer of commitments can take a few minutes.  If you are developing and testing your code, this can become quite a bottle-neck for your productivity. Accordingly, we've provided a set of stub proofs that always verify. *These are the default*.  They are much faster to use for when you aren't working directly on the circuits (but of course don't provide any assurance of correctness of a computation).  You can choose whether to use the real or stubbed proofs via the environment variable `USE_STUBS` in the `deployer` service in the `docker-compose.yml` file.


# Acknowledgements

We gratefully acknowledge the inspiration of the Ethereum Foundation and, particularly, Barry Whitehat and Wanseob Lim and their [zkopru](https://ethresear.ch/t/zkopru-zk-optimistic-rollup-for-private-transactions/7717) application.

We make use of the [ZoKrates](https://zokrates.github.io/) compiler, which removes much of the hard work of developing ZKP circuits.

We hope that we have credited everyone who contributed significantly to this project but please let us know if we have missed you out and we'll add you here!
