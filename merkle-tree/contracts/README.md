# Example Contracts

[Example contracts](/deployer/contracts/README.md) are (by default) provided in the 'deployer' microservice.

To deploy those contracts from **this** merkle-tree microservice instead:

- copy the contracts into this folder (/merkle-tree/contracts),
- set the `DEPLOYMENT_LOCALITY` environment variable to `DEPLOYMENT_LOCALITY = 'local'` in the [docker-compose.yml](/docker-compose.yml) file.

Before deploying, the contracts will need to be compiled (in order to generate the contracts' json interfaces in the ../build/contracts/ folder). The simplest way to do this is with truffle:
`cd path/to/merkle-tree/merkle-tree/`  
`truffle compile --all`

The contracts will then be deployed when the microservice is started with:  
`docker-compose up`.
