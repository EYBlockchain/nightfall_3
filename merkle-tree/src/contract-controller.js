/**
@module contract-controller.js
@desc
@author iAmMichaelConnor
*/

import Web3 from './web3';

import { MetadataService } from './db/service';

const web3 = Web3.connect();

/**
Gets a web3 contract instance a contract, and checks its consistency with the merkle tree's existing metadata db.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function instantiateContract(db, contractName) {
  console.log(`\nsrc/contract-controller instantiateContract(db, ${contractName})`);

  const metadataService = new MetadataService(db);

  // retrieve the address of the contract we wish to filter events for:
  const { contractAddress } = (await metadataService.getContractAddress()) || {};

  const { contractInterface } = (await metadataService.getContractInterface()) || {};

  const contractInstance = await new web3.eth.Contract(contractInterface.abi, contractAddress);

  return contractInstance;
}

export default {
  instantiateContract,
};
