/**
@module contract-controller.js
@desc
@author iAmMichaelConnor
*/

import config from 'config';

import { MetadataService } from './db/service';
import deployer from './deployer';
import deployerRest from './rest/deployer';
import utilsWeb3 from './utils-web3';
import utilsPoll from './utils-poll';
import Web3 from './web3';

const web3 = Web3.connect();

/**
Gets a web3 instance of a contract from some external contract deployment microservice (a.k.a. 'deployer') and assembles a contract instance
@returns {false | object} Polling functions MUST return FALSE if the poll is unsuccessful. Otherwise we return the MerkleTree.sol contract instance.
*/
const getContractInstancePollingFunction = async args => {
  try {
    const { contractName } = args;
    const contractInstance = await deployerRest.getContractInstance(contractName);
    return contractInstance;
  } catch (err) {
    console.log(
      `Got a polling error "${err}", but that might be because the external server missed our call - we'll poll again...`,
    );
    return false;
  }
};

async function getContractInstanceFromRemote(db, contractName) {
  const metadataService = new MetadataService(db);

  // retrieve the contract abi data necessary to generate a web3 instance of the contract, and create that contractInstance:
  // we need to poll, in case the service isn't 'up' yet:
  const contractInstance = await utilsPoll.poll(
    getContractInstancePollingFunction,
    config.POLLING_FREQUENCY,
    { contractName },
  );
  // console.log('contractInstance:');
  // console.log(contractInstance);

  // retrieve the address of the contract we wish to filter events for:
  let { contractAddress } = (await metadataService.getContractAddress()) || {};

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

  return contractInstance;
}

/**
Gets a web3 contract instance a contract, and checks its consistency with the merkle tree's existing metadata db.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function getContractInstanceFromMongoDB(db, contractName) {
  console.log(`\nsrc/contract-controller getContractInstanceFromMongoDB(db, ${contractName})`);

  const metadataService = new MetadataService(db);

  // retrieve the address of the contract we wish to filter events for:
  const { contractAddress } = (await metadataService.getContractAddress()) || {};

  const { contractInterface } = (await metadataService.getContractInterface()) || {};

  const contractInstance = await new web3.eth.Contract(contractInterface.abi, contractAddress);

  return contractInstance;
}

async function getContractInstanceFromBuildFolder(db, contractName) {
  console.log(`\nsrc/contract-controller getContractInstanceFromBuildFolder(db, ${contractName})`);

  const metadataService = new MetadataService(db);

  let contractAddress = await utilsWeb3.getContractAddress(contractName);

  let contractInstance;

  // 'local'
  console.log(`The contract was deployed locally...`);
  if (contractAddress === undefined) {
    // if no contractAddress found in the build folder, then presumably the contract hasn't yet been deployed.
    // Deploy the contract:
    console.log(
      `No contractAddress found in the contract's JSON interface. Deploying the contract...`,
    );

    contractInstance = await deployer.deploy(contractName);
    contractAddress = contractInstance._address; // eslint-disable-line no-underscore-dangle
    console.log(`Contract successfully deployed to ${contractAddress}.`);
  } else {
    // else, retrieve the contract from the 'build' folder:
    contractInstance = await utilsWeb3.getContractInstance(contractName, contractAddress);
  }

  // Then add its address to the db:
  console.log(`Adding contractAddress ${contractAddress} to the merkle-tree's metadata db...`);
  await metadataService.insertContractAddress({ contractAddress });

  return contractInstance;
}

/**
Gets a web3 contract instance a contract, and checks its consistency with the merkle tree's existing metadata db.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function instantiateContract(db, contractName) {
  console.log(`\nsrc/contract-controller instantiateContract(db, ${contractName})`);
  let contractInstance;
  // different logic is needed depending on where the contract's interface is stored:
  switch (config.contractLocation) {
    case 'remote':
      // 'remote' - get the contract from an external deployment microservice
      console.log(`\nGetting contract from contractLocation 'remote'...`);
      contractInstance = await getContractInstanceFromRemote(db, contractName);
      break;

    case 'mongodb':
      // 'mongodb' - get the contract information from mongodb (e.g. if the info had been POSTed there by some external microservice)
      console.log(`\nGetting contract from contractLocation 'mongodb'...`);
      contractInstance = await getContractInstanceFromMongoDB(db, contractName);
      break;

    default:
      // 'default' - get the contract JSON from the build folder
      console.log(`\nGetting contract from contractLocation 'app/build/'...`);
      contractInstance = await getContractInstanceFromBuildFolder(db, contractName);
  }
  return contractInstance;
}

export default {
  instantiateContract,
};
