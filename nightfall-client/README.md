<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [nightfall-client](#nightfall-client)
  - [Building and testing nightfall-client](#building-and-testing-nightfall-client)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-client

This code generates a containerised application that can be used to interact with Nightfall_3 via
http endpoints.

It has a docker-compose.yml file that will run nightfall-client up with local file system bindings
as well as a number of supporting services. This is useful for development work (you can change
source code without having to rebuild the Docker image).

nightfall-client requires a number of services to be present for it to work. The following
instructions explain how to run all of these up, in a similar 'developer' mode with local file
system bindings.

If you just want to run Nightfall_3 then an easier way is to use
[start-nightfall script](https://github.com/EYBlockchain/nightfall_3), which does a similar job but
with all necessary services conteainerised.

Check out the [Nightfall_3](https://github.com/EYBlockchain/nightfall_3) meta repository for an
overview of all the Nightfall_3 services.

## Building and testing nightfall-client

You need to configure a `client.env` file in the root folder of `nightfall-client` with the needed
variables to run the client.

```
ETH_NETWORK=goerli or mainnet
BLOCKCHAIN_URL=your web3 url provider to access the blockchain
CIRCUIT_FILES_URL=url of the repository for the circuit files
CONTRACT_FILES_URL=url of the repository for the contract files
```

To run the script with existing images:

```
./start-client -c
```

To run the script in development mode binding your local files with your changes:

```
./start-client -c -d
```

This will run a docker-compose with the needed components:

- client. Nightfall client service with endpoints to interact with.
- worker. Zokrates worker service used by the client to generate the proofs.
- rabittmq. Queue service used by the client to manage some queues.
