# nightfall_3

## Overview

_Please note that this is experimental software and is still undergoing development. It should not
be used to transfer items of material value_

Nightfall_3 is an application for transferring ERC20, ERC721 and ERC1155 applications under Zero
Knowledge. It abstracts away any need to deal directly with ZKP artefacts and provides a simple
token-transfer API. When used correctly, it will hide the recipient and the token being transferred.

Nightfall_3 uses optimistic rollups to counter the high gas costs of direct ZKP transactions. It can
complete a ZKP transfer for approximately 10 kGas. This compares with 700 kGas for the original
Nightfall application. As a Layer 2 solution with on-chain data availability, Nightfall_3 can
perform a private transfer for less than half the cost of a public ERCx transfer whilst maintaining
the security and consensus assumptions from the Ethereum Mainnet.

## Setup

### Prerequisites

This application runs in docker containers so you will need Docker installed and you must allocate
14 GB of RAM and 4 GB of swap to the Docker containers. Most problems are caused by the containers
not having access to enough memory. We also recommend allocating at least 4 cores to Docker if you
are running in a virtual linux environment (e.g. on a Mac).

You will need a local copy of `node` and `npm` to run the tests and `git` to clone the repository.
We have tested with versions 16.17.0 and 8.15.0 of `node` and `npm`, respectively.

The application will run happily on a MacBook pro and most Linux implementations but Windows isn't
supported. The code is in the process of being combined into a monorepo, so there may be a few code
repetitions. We'll get to those soon but they don't affect functionality.

### To setup the application

Clone this GitHub repository, then `cd` into it:

You need to run a setup script the first time that you use nightfall_3. This will install all of the
dependencies.

```sh
./bin/setup-nightfall
```

One can set the environment variable `NF_SERVICES_TO_START` with the list of the services desired to
build up (e.g. `NF_SERVICES_TO_START=client,worker,optimist ./setup-nightfall`).

### To start the application

If running for first time, do the setup as above and then run this script:

```sh
./bin/start-nightfall -l | -g | -r [-d]
```

One can set the environment variable `NF_SERVICES_TO_START` with the list of the services desired to
start up (e.g. `NF_SERVICES_TO_START=client,worker,optimist ./bin/start-nightfall`).

This will bring up the application. You can run it either with a Ganache blockchain simulator or a
real blockchain client which exposes a websocket connection on localHost:8546. See below for more
details on how to do the latter as there are some additional considerations.

- Environment
  - Use `-g` to use a Ganache client inside the container
  - Use `-l` to use some localhost client running on your machine. We recommend using Ganache first
    to check everything works, because it's considerably faster.
  - Use `-r` to use ropsten node hosted by the dev team. Note: with option -r set environment
    variable $ROPSTEN_NODE, $FROM_ADDRESS and $ETH_PRIVATE_KEY to testnet node URL, EOA address and
    EOA address's private key, respectively
- Use the `-d` or `--dev` flag to bind mount the development folders inside the containers, making
  it useful for development purposes. Omit it to deploy the services using the existing `ghcr`
  images.

Startup will take a minute or so, depending on your machine. You'll see lots of warnings as it runs
up from the `optimist` and `timber` containers. That's entirely fine, they're just waiting for the
other services that they need to start up. You should see no errors however. If you do, something
has broken.

Note that during compilation of the Solidity (part of the startup), you will receive one compiler
warning. This is because we read calldata directly via `msg.data` when a block is proposed, in the
interests of Gas efficiency. As a result, the compiler thinks were not using one of our function
parameters. We've been unable to think of a good workaround as yet.

Eventually you will see a message to the effect that the `deployer` container has exited with
code 0.

```sh
nightfall_3_deployer_1 exited with code 0
```

This means that deployment is complete and the application is ready to use. You can run the tests at
this point.

### To end the application

To stop the application, you can run `npm run nightfall-down` and it should exit cleanly.

### To export nightfall state

In some circumstances it may be useful to export nightfall state so that it can be replicated at any
point in time. For example, when doing load testing and many thousands of transactions needs to be
generated, saving the nightfall state at the moment when all transactions have been generated may be
benefitial.

The exported nightfall state includes:

- blockchain
- file system (contracts and circuits)
- client and optimist mondoDbs.

This feature only works with `geth` and not with `ganache`.

To export nightfall state, run `./bin/export-nightfall <folder>` at the point where you want to save
the state. Data is backup in `nightfall_3/backup` folder

### To import nightfall state

One can also import a previously exported state. To do so:

```
./bin/geth-standalone -i <FOLDER>
./bin/start-nightfall -l -d
./bin/import-nightfall <FOLDER>
```

Each command will need to be entered in a different window.

## Testing

Open a separate terminal window, cd to the nightfall_3 repo and run

```sh
npm test
```

This will test the application, creating transactions and assembling them into layer 2 blocks. By
default the application is configured to put only two transactions into a layer 2 block. This is to
make the standard tests fast.

### Measuring Block Gas used

In reality, a value of two transactions per block, although convenient for testing, wouldn't make
very efficient use of Optimism. A more realistic value is 32 transactions per layer 2 block. This
value can be configured by the environment variable `TRANSACTIONS_PER_BLOCK`. This is important for
the Block Gas measurement, which only makes sense for more realistic block sizes.

To measure the Block Gas used per transaction, export the `TRANSACTIONS_PER_BLOCK` variable in both
the terminal which will run nightfall and the terminal from which the test will be run, setting it
to the value at which you want to run the test (32 in the example here):

```sh
export TRANSACTIONS_PER_BLOCK=32
```

Any reasonable value will work but they must be the same for both nightfall and the test. Obviously,
it only makes sense to compare performance at the same value of `TRANSACTIONS_PER_BLOCK`.

Then start nightfall:

```sh
./bin/start-nightfall -g -d -s
```

Then, in the other terminal window run the test

```sh
npm run test-gas
```

The test will print out values of gas used for each type of transaction as it progresses.

Do not forget to set the `TRANSACTIONS_PER_BLOCK` back to 2 when you have finished or the other
tests may fail in strange ways.

```sh
export TRANSACTIONS_PER_BLOCK=2
```

### Test chain reorganisations

In Layer 2 solutions, Layer 2 state is held off-chain but created by a series of Layer 1
transactions (e.g. the proposal of a Layer 2 block). In the case of Nightfall_3 these Layer 2 state
updates are signalled by blockchain Events being 'broadcast'. Thus, all Layer 2 solutions must be
able to correct their Layer 2 state when it becomes invalidated by a Layer 1 chain reorganisation.
This is actually quite hard to test because it requires one to be able to generate a chain
reorganisation to order. To facilitate such a test, we create a private Geth-based blockchain
(details of how to run this up are below) consisting of two clients, two miners and a bootnode. We
can then freeze half of the nodes by pausing their containers and creating transaction on the
un-paused nodes to create a 'split-brain'. Inverting the process to put different transactions on
the other part of the network will create a chain fork and, when all the nodes are brought back on
line, a chain reorganisation will occur. Currently test coverage is fairly limited because there are
a number of sub-classes of chain fork that have to be simulated. We continue to work on these. These
tests are run, once the private Geth blockchain is started, with:

```sh
npm test-chain-reorg
```

### Test ping-pong with multi proposers

The ping-pong test uses 2 users and 2 proposers by default to test during a period of time:

- 2 users sending deposit and transfer transactions between them.
- 2 proposers proposing blocks and rotating between them based on the PoS weighted round robin.
- checks for the users layer 2 balances.
- checks for the rotation, stake and statistics for the proposers.

To configure the proposers there is a docker-compose file in `docker/docker-compose.proposers.yml`
that define the containers `proposer_x`, `proposer_optimist_x` and `optimist_mongodb_x` for each
proposer and the corresponding parameters for each container. You can add more proposers if needed
configuring the parameters properly. The test detects the proposers parameters from the `yml` file
and will run the test with the configured proposers.

To test you can run in a terminal

```sh
start-nightfall -g -d
```

And in another terminal once the Nightfall deployer has exited:

```sh
npm run ping-pong
```

## Using a Geth private blockchain

The script `./bin/geth-standalone` will run up a private blockchain consisting of a bootnode, two
client nodes and two miners. This is required for testing chain reorganisations (Ganache does not
simulate a chain-reorg) but can be used for other tests or general running. It's slower than using
Ganache but it does provide a more real-life test. Note also that the private chain exposes a client
on `host.docker.internal:8546`. On a Mac this will map to `localhost` but it won't work on any other
machine. If you aren't on a Mac then you can do one of these 3 options:

- If you are on a Linux you can edit `/etc/hosts` file and add a map from your private IP address of
  your connected interface to the domain `host.docker.internal`. In this case `127.0.0.1` is not
  valid. You can check your private IP address with `ip address`.
- Edit `nightfall-deployer/truffle-config.js` to point to the IP of your `localhost`
- Use the docker-compose line `external_servers` to inject a hostname into the containers host file
  (see the Github workflows for further clues about how to do that).

To use the private blockchain:

- Run up the private chain with `./bin/geth-standalone -s`
- Start terminal logging with `./bin/geth-standalone -l` and wait for the DAG build to complete
- Start Nightfall in another terminal with the `-l` option (`./bin/start-nightfall -l`)

That's it. You can shut down the geth blockchain with `./bin/geth-standalone -d` or pause/unpause it
with `-p`, `-u`.

## Software Development Kit

Nightfall_3 provides an SDK which makes it easy to develop applications that use Nightfall_3. The
SDK API is documented in `./doc/lib/Nf3.html` and is provided by the NF_3 class `./cli/lib/nf3.mjs`.

## Apps

Nightfall_3 provides some reference applications (which make use of the SDK) so that you can
exercise its features. To use it:

- run up nightfall_3 as described above and wait for the deployment to complete;
- in the `apps` folder there are small applications like `proposer` or `challenger` you can run with
  `./bin/start-apps`. For example, `proposer` will start a small application running which will sign
  block proposal transactions;

## Limitations

Nightfall uses the G16 proof system, and we believe it is
[not vulnerable](./doc/G16-malleability.md) to its malleability.

## Troubleshooting

If something goes wrong, you have some friends to help you, namely

```sh
docker system prune -a
docker volume prune
```

These will hopefully delete every image, container and volume so you should have a clean slate. Mind
that you need to run `./bin/setup-nightfall` again.

# Acknowledgements

We gratefully acknowledge the inspiration of the Ethereum Foundation and, particularly, Barry
Whitehat and Wanseob Lim and their
[zkopru](https://ethresear.ch/t/zkopru-zk-optimistic-rollup-for-private-transactions/7717)
application.

We make use of the [Circom](https://docs.circom.io/) compiler, which removes much of the hard work
of developing ZKP circuits.

We hope that we have credited everyone who contributed significantly to this project but please let
us know if we have missed you out and we'll add you here!
