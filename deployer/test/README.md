See [the README in deployer/contracts](../contracts/README.md) for more info on deployment of the contracts.

# To run a specific test:  

_Note: in the steps below, you can replace `-f docker-compose.remote.pull.yml` with one of the other provided docker-compose files, such as `-f docker-compose.mongodb.yml`._  

First, compile the contracts:

```sh
cd deployer
truffle compile --all
cd ..
```

## deployment.test.js  

This test relies on the deployer microservice's url '<http://deployer:80>' being discoverable by itself. This is handled by the docker-compose file(s).

In one terminal window:
`docker-compose up merkle-tree`  

Then in another terminal window:  
`docker-compose -f docker-compose.remote.pull.yml run --rm deployer npx mocha --exit --require @babel/register 'test/deployment.test.js'`

**Understanding this command:**  
`docker-compose -f docker-compose.remote.pull.yml` selects the docker-compose file to use.  
`run --rm deployer` creates an instance of the deployer microservice (along with any dependent service containers) and runs whatever command follows.  
`npx mocha` run mocha.  
`--exit` exits the mocha test once its finished (although this will leave the containers still running).  
`--require @babel/register` to help mocha understand the js syntax used.

## MerkleTreeController.test.js  

In one terminal window:  
`docker-compose up`  

Then in another terminal window:  
`docker-compose -f docker-compose.remote.pull.yml run --rm deployer npx mocha --exit --require @babel/register 'test/MerkleTreeController.test.js'`

This test works for any hash or curve type.

## MultipleMerkleTreesController.test.js  

`docker-compose -f docker-compose.remote.pull.yml run --rm deployer npx mocha --exit --require @babel/register 'test/MultipleMerkleTreesController.test.js'`

This test demonstrates using multiple merkle trees per smart contract. Be sure to specify the `treeId` (either `a` or `b`) in the body of any API requests sent for this test.

This test only works for hashing with SHA.

# After testing

`docker-compose down -v` to kill the docker containers, volumes, and networks.
