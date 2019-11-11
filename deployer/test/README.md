See [the README in deployer/contracts](../contracts/README.md) for more info on deployment of the contracts.

Importantly, ensure you've run the below before starting the tests:

```solidity
cd path/to/deployer
truffle compile --all
```

## To run the tests:

In one terminal window:  
`docker-compose up`  

Then in another terminal window:
`docker-compose run --rm deployer npm run test`

Or, to run a specific test:

#### deployment.test.js  

(You can preceed this test with deployment of other microservices, in order to see their console logging output, with `docker-compose up` in a terminal window).

`docker-compose run --rm deployer npx mocha --exit --require @babel/register 'test/deployment.test.js'`

**Understanding this command:**  
`docker-compose run --rm deployer` creates an instance of the deployer microservice (along with any dependent service containers) and runs whatever command follows.
`npx mocha` run mocha.
`--exit` exits the mocha test once its finished (although this will leave the containers still running).
`--require @babel/register` to help mocha understand the js syntax used.

#### MerkleTreeController.test.js  

This test relies on the deployer microservice's url '<http://deployer:80>' being discoverable by itself. We achieve this easily by running the 'main' docker-compose script first:  

In one terminal window:  
`docker-compose up`  

Then in another terminal window:  
`docker-compose run --rm deployer npx mocha --exit --require @babel/register 'test/MerkleTreeController.test.js'`


## After testing

`docker-compose down -v` to kill the docker containers, volumes, and networks.
