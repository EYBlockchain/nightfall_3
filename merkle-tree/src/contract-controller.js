/**
@module index.js
@desc file that starts up the filter
@author iAmMichaelConnor
*/

import config from 'config';
import utilsWeb3 from './utils-web3';
import utilsPoll from './utils-poll';

import { MetadataService } from './db/service';

import deployer from './rest/deployer';

/**
Gets a web3 instance of a contract from some external contract deployment microservice (a.k.a. 'deployer') and assembles a contract instance
@returns {false | object} Polling functions MUST return FALSE if the poll is unsuccessful. Otherwise we return the MerkleTree.sol contract instance.
*/
const getContractInstancePollingFunction = async args => {
  try {
    const { contractName } = args;
    const contractInstance = await deployer.getContractInstance(contractName);
    return contractInstance;
  } catch (err) {
    console.log(
      `Got a polling error "${err}", but that might be because the external server missed our call - we'll poll again...`,
    );
    return false;
  }
};

/**
Gets a web3 contract instance a contract, and checks its consistency with the merkle tree's existing metadata db.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function instantiateContract(db) {
  console.log(`\nsrc/contract-controller instantiateContract(db)`);

  const metadataService = new MetadataService(db);

  // retrieve the address of the contract we wish to filter events for:
  let { contractAddress } = (await metadataService.getContractAddress()) || {};
  const contractName = config.contract.name;
  let contractInstance;

  // different logic is needed depending on whether the contract was deployed within this 'local' microservice, or in a 'remote' microservice.
  switch (config.contract.deploymentLocality) {
    case 'remote':
      console.log(`The contract was deployed remotely...`);
      // retrieve the contract abi data necessary to generate a web3 instance of the contract, and create that contractInstance:
      contractInstance = await utilsPoll.poll(
        getContractInstancePollingFunction,
        config.POLLING_FREQUENCY,
        { contractName },
      );
      // console.log('contractInstance:');
      // console.log(contractInstance);

      if (contractAddress === undefined) {
        // if no contractAddress in the mongodb, add it to the db:
        contractAddress = contractInstance._address; // eslint-disable-line no-underscore-dangle
        console.log(
          `contractAddress ${contractAddress} not yet added to the merkle-tree's metadata db. Adding it now...`,
        );
        await metadataService.insertContractAddress({ contractAddress });
      } else if (contractAddress !== contractInstance._address) { // eslint-disable-line no-underscore-dangle, prettier/prettier
        // here, we've noticed that the stored mongodb contractAddress !== the address retrieved from the external microservice.
        throw new Error(
          `Unexpected mismatch between the stored mongodb contractAddress (${contractAddress}), and the address retrieved from the external microservice (${contractInstance._address}).`, // eslint-disable-line no-underscore-dangle, prettier/prettier
        );
      }
      break;

    default:
      // 'local'
      console.log(`The contract was deployed locally...`);
      if (contractAddress === undefined) {
        // if no contractAddress in the mongodb, then presumably the contract hasn't yet been deployed.
        // Deploy the contract:
        console.log(`No contractAddress found in db. Deploying the contract...`);
        contractInstance = deployer.deploy();

        contractAddress = contractInstance._address; // eslint-disable-line no-underscore-dangle
        console.log(`Contract successfully deployed to ${contractAddress}.`);
        // Then add it's address to the db:
        console.log(
          `contractAddress ${contractAddress} not yet added to the merkle-tree's metadata db. Adding it now...`,
        );
        await metadataService.insertContractAddress({ contractAddress });
      } else {
        // else, retrieve the contract from the 'build' folder:
        contractInstance = utilsWeb3.getContractInstance(contractName, contractAddress);
      }
  }

  return contractInstance;
}

export default {
  instantiateContract,
};
