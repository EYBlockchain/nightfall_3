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
      // deploy the contract:
      const contractInstance = await deployer.deploy(contractName);

      const contractAddress = contractInstance._address; // eslint-disable-line no-underscore-dangle

      const contractInterface = utilsWeb3.getContractInterface(contractName);

      await merkleTree.postContractInterface(contractName, JSON.stringify(contractInterface));
      await merkleTree.postContractAddress(contractName, contractAddress);
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
