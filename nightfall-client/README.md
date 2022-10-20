<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [nightfall-client](#nightfall-client)
  - [Building and testing nightfall-client](#building-and-testing-nightfall-client)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-client

## Requirements

This application runs in docker containers so you will need Docker installed and Docker Compose
v3.5.

You will need a local copy of `node` and `npm` to run the tests and `git` to clone the repository.
We have tested with versions 16.17.0 and 8.15.0 of `node` and `npm`, respectively.

This code generates a containerised client application that can be used to interact with Polygon
Nightfall via http endpoints.

It has a docker-compose.yml file that will run nightfall-client up with local file system bindings
as well as a number of supporting services. This is useful for development work (you can change
source code without having to rebuild the Docker image).

Nightfall-client requires a number of services to be present for it to work in testnet/mainnet. The
following instructions explain how set up testnet and mainnet deployment for this client.

## Building and testing nightfall-client

### Testnet and mainnet deployment

To test Polygon Nightfall with this client in the current testnet or mainnet deployment you need to
configure a `client.env` file in the root folder of `nightfall-client` with the needed variables to
run the client.

```
ETH_NETWORK=goerli or mainnet
BLOCKCHAIN_WS_HOST=your web3 host to access the blockchain
```

Example of `client.env`:

```
ETH_NETWORK=goerli
BLOCKCHAIN_WS_HOST=eth-goerli.alchemyapi.io/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxs
```

To run the script with existing images of the different services based on the
`docker-compose.client.yml` of the Polygon Nightfall root folder:

```
./start-client
```

For development purposes you can pass CIRCUIT_FILES_URL and CONTRACT_FILES_URL.

```
CIRCUIT_FILES_URL=url of the repository for the circuit files
CONTRACT_FILES_URL=url of the repository for the contract files
```

This will run a docker-compose with the needed components:

- client. Nightfall client service with endpoints to interact with.
- worker. Zokrates worker service used by the client to generate the proofs.
- rabittmq. Queue service used by the client to manage some queues.

### Localhost deployment

If you just want to run Polygon Nightfall in localhost then use `./bin/start-nightfall` script with all
necessary services conteainerised in localhost. See the README in the
[Polygon Nightfall](https://github.com/EYBlockchain/nightfall_3) repository
