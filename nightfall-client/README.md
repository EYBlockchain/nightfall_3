<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [nightfall-client](#nightfall-client)
  - [Building and testing nightfall-client](#building-and-testing-nightfall-client)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-client

This code generates a containerised application that can be used to interact with Polygon Nightfall
via http endpoints.

It has a docker-compose.yml file that will run nightfall-client up with local file system bindings
as well as a number of supporting services. This is useful for development work (you can change
source code without having to rebuild the Docker image).

nightfall-client requires a number of services to be present for it to work. The following
instructions explain how to run all of these up, in a similar 'developer' mode with local file
system bindings.

If you just want to run Polygon Nightfall then an easier way is to use
[start-nightfall script](https://github.com/EYBlockchain/nightfall_3), which does a similar job but
with all necessary services conteainerised.

Check out the [Polygon Nightfall](https://github.com/EYBlockchain/nightfall_3) meta repository for
an overview of all the Polygon Nightfall services.

## Building and testing nightfall-client

### Testnet and mainnet deployment

To test Polygon Nightfall with this client in the current testnet or mainnet deployment you need to
configure a `client.env` file in the root folder of `nightfall-client` with the needed variables to
run the client.

```
ETH_NETWORK=goerli or mainnet
BLOCKCHAIN_URL=your web3 url provider to access the blockchain
```

Example of `client.env`:

```
ETH_NETWORK=goerli
BLOCKCHAIN_URL=wss://eth-goerli.alchemyapi.io/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxs
```

To run the script with existing images of the different services based on the
`docker-compose.client.yml` of the Polygon Nightfall root folder:

```
./start-client
```

A developer who is adding some functionality or fixing some bug in the `nightfall-client` repository
should run the script in development mode with the changes in his local `nightfall-client`
repository with binding his local files:

```
./start-client -d
```

Also for development purposes you can pass CIRCUIT_FILES_URL and CONTRACT_FILES_URL.

```
CIRCUIT_FILES_URL=url of the repository for the circuit files
CONTRACT_FILES_URL=url of the repository for the contract files
```

This will run a docker-compose with the needed components:

- client. Nightfall client service with endpoints to interact with.
- worker. Zokrates worker service used by the client to generate the proofs.
- rabittmq. Queue service used by the client to manage some queues.

### Localhost deployment

If you just want to run Polygon Nightfall in localhost then use `start-nightfall` script with all
necessary services conteainerised in localhost. See the README in the
[Polygon Nightfall](https://github.com/EYBlockchain/nightfall_3) repository
