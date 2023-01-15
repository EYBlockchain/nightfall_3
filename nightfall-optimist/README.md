[![openapi friendly](https://img.shields.io/badge/openapi-friendly)](https://swagger.io/specification/)

# nightfall-optimist

## Requirements

This application runs in docker containers so you will need Docker installed and Docker Compose
v3.5.

You will need a local copy of `node` and `npm` to run the tests and `git` to clone the repository.
We have tested with versions 16.17.0 and 8.15.0 of `node` and `npm`, respectively.

This code generates a containerised client application that can be used to interact with
Nightfall via http endpoints.

It has a docker-compose.yml file that will run nightfall-optimist up with local file system bindings
as well as a number of supporting services. This is useful for development work (you can change
source code without having to rebuild the Docker image).

Nightfall-optimist requires a number of services to be present for it to work. The
following instructions explain how set up testnet and mainnet deployment for this client.

## Building and testing nightfall-optimist

Optimists can be launched independently after deployment. Only requirement is that contract and circuit artifacts
generated during deployment are left in some server so that they can be downloaded when deploying a standalone Optimist.

Optimist is configured using `docker/docker-compose.optimist.yml`. To deploy a full Optimist, three services are launched:

- **optimist** 
- **mongodb**

### Configuration 

If some of the env variables defined in `docker/docker-compose.optimistyml` need to be configured, you must create a file called `optimist.env` in `nightfall-optimist/` folder with the new values. Default values defined in the docker compose configuration file are valid for deployments to localhost only using ganache except for `CONTRACT_FILES_URL`. You will need to ensure that after deployment, the artifacts have been copied there.

For example, for a deployment of nightfall in `goerli` testnet, a new optimist configuration file would look something like the one below.

```
BLOCKCHAIN_WS_HOST=eth-goerli.alchemyapi.io/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxs
CONTRACT_FILES_URL=https://nightfallv3.s3.eu-central-1.amazonaws.com/build
```

Here `CONTRACT_FILES_URL` is configured with the URL of an AWS S3 bucket where artifacts have been stored.

To deploy multiple Optimists, you will need to modify values in `docker/docker-compose.optimist.yml` to define additional services. Simple copy definition of `optimist` and `mongodb` services as many times as needed and edit some of the 
properties.

- Default **service** name defined in `docker/docker-compose.optimist.yml` is `optimist_1`. Update name if more than one optimist needs to be created.
- **image**: Points to default location where docker images are stored. Update value where desired docker image can be retrieved.
- **volumes**: Single volume defined where contracts are stored. Update source name if multiple Optimists are deployed.
- **ports**: Default ports. Update external port if multiple Optimists are deployed.
- **depends_on** : Container dependencies. Updates dependency services accordingly.


### Start Optimist

```
./start-optimist
```

### Stop Optimist

```
./stop-optimist
```
