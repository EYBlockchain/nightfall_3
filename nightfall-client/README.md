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

This code generates a containerised client application that can be used to interact with
Nightfall via http endpoints.

It has a docker-compose.yml file that will run nightfall-client up with local file system bindings
as well as a number of supporting services. This is useful for development work (you can change
source code without having to rebuild the Docker image).

Nightfall-client requires a number of services to be present for it to work. The
following instructions explain how set up testnet and mainnet deployment for this client.

## Building and testing nightfall-client
Clients can be lauched independently after deployment. Only requirement is that contract and circuit arfifacts
generated during deployment are left in some server so that they can be downloaded when deploying a standalone Client.

Client is configured using `docker/docker-compose.client.yml`. To deploy a full Client, three services are launched:
- **client** 
- **worker** 
- **mongodb**

### Configuration 
If some of the env variables defined in `docker/docker-compose.client.yml` need to be configured, you must create a file called `client.env` in `nightfall-client/` folder with the new values. Default values defined in the docker compose configuration file are valid for deployments to localhost only using ganache.

For example, for a deployment of nightfall in `goerli` testnet, a new client configuration file would look something like the one below.

```
BLOCKCHAIN_WS_HOST=eth-goerli.alchemyapi.io/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxs
CONTRACT_FILES_URL=https://nightfallv3.s3.eu-central-1.amazonaws.com/build
CIRCUIT_FILES_URL=https://nightfallv3.s3.eu-central-1.amazonaws.com/proving_files
```

Here `CONTRACT_FILES_URL` and `CIRCUIT_FILES_URL` are configured with the URL of an AWS S3 bucket where artifacts have been stored.

To deploy multiple Clients, you will need to modify values in `docker/docker-compose.client.yml` to define additional services. Simple copy definition of `client`, `worker` and `mongodb` services as many times as needed and edit some of the 
properties.

- Default **service** name defined in `docker/docker-compose.client.yml` is `client_1`. Update name if more than one Client
needs to be created.
- **image**: Points to default location where docker images are stored. Update value where desired docker image can be retrieved.
- **volumes**: Single volume defined where contracts are stored. Update source name if multiple Clients are deployed.
- **ports**: Default ports. Update external port if multiple Clients are deployed.
- **depends_on** : Container dependencies. Updates dependency services accordingly.


### Start Client
```
./start-client
```

### Stop Client
```
./stop-client
```
