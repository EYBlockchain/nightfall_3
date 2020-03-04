/**
@module index.js
@desc
@author iAmMichaelConnor
*/

import config from 'config';

import app from './app';
import deployer from './deployer';
import utilsWeb3 from './utils-web3';
import merkleTree from './rest/merkle-tree';

const main = async () => {
  try {
    const { contractNames } = config;
    
    await contractNames.forEach(async contractName => {
      switch (config.PUSH_OR_PULL) {
        default:
          // 'pull': deploy the contract, and then wait for GET requests to 'pull' the contract information from the merkle-tree microservice.
          await deployer.deploy(contractName);
          break;

        case 'push': {
          // 'push': deploy the contract and POST (push) the contract information to the merkle-tree microservice:
          const contractInstance = await deployer.deploy(contractName);

          const contractAddress = contractInstance._address; // eslint-disable-line no-underscore-dangle

          const contractInterface = utilsWeb3.getContractInterface(contractName);

          await merkleTree.postContractInterface(contractName, JSON.stringify(contractInterface));
          await merkleTree.postContractAddress(contractName, contractAddress);
          break;
        }
      }
    });

    app.listen(80, '0.0.0.0', () => {
      console.log(`\ndeployer RESTful API server started on ::: 80`);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

main();
