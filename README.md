# nightfall_3

## Overview

_This code is not owned by EY and EY provides no warranty and disclaims any and all liability for use of this code. Users must conduct their own diligence with respect to use for their purposes and any and all usage is on an as-is basis and at your own risk._

Nightfall_3 is an application for transferring ERC20, ERC721 and ERC1155 applications under Zero Knowledge. It abstracts away any need to deal directly with ZKP artefacts and provides a simple token-transfer API. When used correctly, it will hide the recipient and the transferred token.

Nightfall_3 uses optimistic rollups to counter the high gas costs of direct ZKP transactions. Under the right conditions, it can complete a ZKP transfer for approximately 6500 Gas. This compares with 700 kGas for the original Nightfall application. As a Layer 2 solution with on-chain data availability, Nightfall_3 can perform a private transfer for approximately one tenth cost of a public ERCx transfer whilst maintaining the security and consensus assumptions from the Ethereum Mainnet.

Nightfall is intended as an enterprise application. In its basic form, it does not provide a GUI and is intended to be integrated to an ERP or similar system via its APIs. Uniquely (we believe) it provides decentralised access control.

This readme, and the other documents that it points to will help you get up and running. There is a Nightfall_3 [Discord](https://discord.gg/EE8CrJ63vP) server too.

We recommend that you get Nightfall_3 operating locally on your laptop before attempting to use it with the deployments on Mumbai or Polygon PoS. It is a fairly complex but powerful application, and so you will need to invest some time to understand it.

## How to run a local instance for test purposes

This section explains how to quickly run a self-contained, local version of Nightfall_3 on your laptop (Mac or Linux) using Ganache as blockchain simulator for test purposes.

### Prerequisites

This application runs in docker containers so you will need Docker installed we ususally allocate 12 GB of RAM and 4 GB of swap to the Docker containers but it will run with less. We also recommend allocating at least 4 cores to Docker if you are running in a virtual Linux environment (e.g. on a Mac).

You will need a local copy of `node` and `npm` to run the tests and `git` to clone the repository. We have tested with versions 16.17.0 and 8.15.0 of `node` and `npm`, respectively.

The application will run happily on a MacBook pro and most Linux implementations but Windows isn't supported.

### To setup the application

Clone this GitHub repository, then `cd` into it:

You need to run a setup script the first time that you use nightfall_3. This will install all of the dependencies and build the container images.

```sh
./bin/setup-nightfall
```

One can set the environment variable `NF_SERVICES_TO_START` here with the list of the services desired to build up (e.g. `NF_SERVICES_TO_START=client,worker,optimist ./setup-nightfall`) but it's simplest to build them all. Make sure all the container images build successfully before proceeding.

### To start the application

At this point do set an enviroment variable to run only the basic set of containers (doing this will speed things up):

```sh
export NF_SERVICES_TO_START=blockchain,client,deployer,optimist
```

Then run this script. It will launch a `Deployer` container which will deploy Nightfall's smart contracts to the blockchain (Ganache in this instance) and perform a basic (insecure) trusted setup, before exiting:

```sh
./bin/start-nightfall -g -d
```

The startup will take a minute or so, depending on your machine. You'll see lots of warnings as it runs up from the `optimist` and `client` containers about being unable to find contract addresses. That's entirely fine, they're just waiting for the other services that they need to start up. You should see no errors, however, other than possibly a `not json message` error (you can ignore that). If you see any other errors, something has broken. You may also notice a few additional containers being run up.  Again, that's fine they are just sevices that the main containers depend on.

Note that during the compilation of the smart contract Solidity (part of the startup), you will receive several compiler warnings. This is because we read calldata directly via `msg.data` when a block is proposed, in the interests of Gas efficiency. As a result, the compiler thinks were not using one of our function parameters. We've been unable to think of a good workaround as yet.

Eventually, you will see a message to the effect that the `deployer` container has exited with code 0.

```sh
nightfall_3_deployer_1 exited with code 0
```

This means that deployment is complete and the application is ready to use. You can run the tests at this point.

### To stop the application

To stop the application, you can simply `cntl-c` in the terminal window and it should exit cleanly.

### Restarting the application

This is exactly the same as starting it for the first time:

```sh
./bin/start-nightfall -g -d
```

It will remember the previous trusted setup (in a Docker volume called `nightfall_3-proving_files`). This is just to save time. You can delete this volume if you wish Nightfall_3 to repeat the trusted setup. All other state will be cleared.

### Running tests

There are _lots_ of tests you can run, both unit tests and integration tests. They are all available, individually, via npm scripts in the root [`package.json`](./package.json) file. Some of them require a certain environment to run, you can check the github actions directory to see how they're configured but for a basic test, no setup is required:

Run unit tests with;

```sh
npm run unit-test
```

And test interactions with ERC20 tokens via;

```sh
npm run test-erc20-tokens
```

You'll need a locally running instance of nightfall in a separate terminal to run the latter.  A running instance is not required for the unit tests.

If all these tests pass, you can be confident that you have a working instance.

```sh
npm run unit-test-x509
```

## Next steps

To understand much more about how Nightfall_3 works, how to run a Nightfall node against its deployed instances, how to configure it and how to get access with an x509 certificate, please see the Nightfall_3 [GitBook](https://westlad.gitbook.io/nightfall_3/). This is still being added to.

## Acknowledgements

We gratefully acknowledge the inspiration of the Ethereum Foundation and, particularly, Barry Whitehat and Wanseob Lim and their [zkopru](https://ethresear.ch/t/zkopru-zk-optimistic-rollup-for-private-transactions/7717) application.

We make use of the [Circom](https://docs.circom.io/) compiler, which removes much of the hard work of developing ZKP circuits.

We hope that we have credited everyone who contributed significantly to this project but please let us know if we have missed you and we'll add you here!
