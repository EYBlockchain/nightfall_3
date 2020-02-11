See [the README in deployer/contracts](../contracts/README.md) for more info on deployment of the contracts.

Importantly, ensure you've run the below before starting the tests:

```solidity
cd path/to/deployer
truffle compile --all
```

## To run a specific test:  

_Note: in the steps below, you can replace `-f docker-compose.remote.pull.yml` with one of the other provided docker-compose files, such as `-f docker-compose.remote.push.yml`._  

_Note, however, that the default `docker-compose.yml` file is a bit more fiddly, because it relies on contracts being deployed via truffle with your application. Tests aren't provided for that file yet._

Or, to run a specific test:  
#### deployment.test.js  

`docker-compose -f docker-compose.remote.pull.yml run --rm deployer npx mocha --exit --require @babel/register 'test/deployment.test.js'`

**Understanding this command:**  
`docker-compose -f docker-compose.remote.pull.yml` selects the docker-compose file to use.  
`run --rm deployer` creates an instance of the deployer microservice (along with any dependent service containers) and runs whatever command follows.  
`npx mocha` run mocha.  
`--exit` exits the mocha test once its finished (although this will leave the containers still running).  
`--require @babel/register` to help mocha understand the js syntax used.

#### MerkleTreeController.test.js  

This test relies on the deployer microservice's url '<http://deployer:80>' being discoverable by itself. We achieve this easily by running the 'main' docker-compose script first:  

In one terminal window:  
`docker-compose -f docker-compose.remote.pull.yml up`  

Then in another terminal window:  
`docker-compose -f docker-compose.remote.pull.yml run --rm deployer npx mocha --exit --require @babel/register 'test/MerkleTreeController.test.js'`


## After testing

`docker-compose -f docker-compose.remote.pull.yml down -v` to kill the docker containers, volumes, and networks.
