/**
@module contract-controller.js
@desc
@author iAmMichaelConnor
*/

import config from 'config';

import { MetadataService } from './db/service';
import deployerRest from './rest/deployer';
import { compileContract } from './compile';
import utilsWeb3 from './utils-web3';
import utilsPoll from './utils-poll';
import Web3 from './web3';
import logger from './logger';

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
    logger.warn(
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

  // retrieve the address of the contract we wish to filter events for:
  let { contractAddress } = (await metadataService.getContractAddress()) || {};

  if (contractAddress === undefined) {
    // if no contractAddress in the mongodb, add it to the db:
    contractAddress = contractInstance._address; // eslint-disable-line no-underscore-dangle
    logger.info(
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
  logger.debug(
    `src/contract-controller getContractInstanceFromMongoDB(db, contractName=${contractName})`,
  );

  const metadataService = new MetadataService(db);

  // retrieve the address of the contract we wish to filter events for:
  const { contractAddress } = (await metadataService.getContractAddress()) || {};

  const { contractInterface } = (await metadataService.getContractInterface()) || {};

  const contractInstance = await new web3.eth.Contract(contractInterface.abi, contractAddress);

  return contractInstance;
}

async function getContractInstanceFromContractsFolder(db, contractName, contractAddress) {
  logger.debug(
    `src/contract-controller getContractInstanceFromContractsFolder(db, contractName=${contractName}, contractAddress=${contractAddress})`,
  );

  const metadataService = new MetadataService(db);

  // compile the contracts in /app/contracts, and save the compiled contract interface json's in /app/build.
  await compileContract(contractName);

  // retrieve the contract from the 'build' folder:
  const contractInstance = await utilsWeb3.getContractInstance(contractName, contractAddress);

  // Then add its address to the db:
  logger.info(`Adding contractAddress ${contractAddress} to the merkle-tree's metadata db...`);
  await metadataService.insertContractAddress({ contractAddress });

  return contractInstance;
}

async function getContractInstanceFromBuildFolder(db, contractName, contractAddress) {
  logger.debug(
    `\nsrc/contract-controller getContractInstanceFromBuildFolder(db, contractName=${contractName})`,
  );

  const metadataService = new MetadataService(db);

  // if no address specified in the API call, then let's try to get one from the contract's json interface in the build folder"
  if (contractAddress === undefined)
    contractAddress = await utilsWeb3.getContractAddress(contractName); // eslint-disable-line no-param-reassign

  if (contractAddress === undefined)
    throw new Error(
      `No deployed contract address found in the contract interface json for ${contractName}`,
    );

  // retrieve the contract from the 'build' folder, and create a web3 contract instance:
  const contractInstance = await utilsWeb3.getContractInstance(contractName, contractAddress);

  // Then add its address to the db:
  logger.info(`Adding contractAddress ${contractAddress} to the merkle-tree's metadata db...`);
  await metadataService.insertContractAddress({ contractAddress });

  return contractInstance;
}

/**
Gets a web3 contract instance a contract, and checks its consistency with the merkle tree's existing metadata db.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function instantiateContract(db, contractName, contractAddress) {
  logger.debug(
    `src/contract-controller instantiateContract(db, contractName=${contractName}, contractAddress=${contractAddress})`,
  );
  let contractInstance;
  // different logic is needed depending on where the contract's interface json is stored:
  switch (config.contractOrigin) {
    case 'remote':
      // 'remote' - get a (truffle-compiled) contract interface json, and the deployed contract address, from an external deployment microservice. A web3 contract instance is created from these components and assigned to contractInstance:
      logger.info(`\nGetting contract from contractOrigin 'remote'...`);
      contractInstance = await getContractInstanceFromRemote(db, contractName);
      break;

    case 'mongodb':
      // 'mongodb' - get a (truffle-comiled) contract interface json, and the deployed contract address, from mongodb (e.g. if the info had been POSTed there by some external microservice). A web3 contract instance is created from these components and assigned to contractInstance:
      logger.info(`\nGetting contract from contractOrigin 'mongodb'...`);
      contractInstance = await getContractInstanceFromMongoDB(db, contractName);
      break;

    case 'compile':
      // 'compile' - Useful if the application using Timber doesn't use truffle to generate contract interface json's. Get solidity contracts from the /app/contracts/ folder, and compile them (using truffle) at startup. A web3 contract instance is created from the compiled contract interface & deployed address and assigned to contractInstance:
      logger.info(
        `Compiling the contracts from '/app/contracts/' and then getting contract from contractOrigin '/app/build/'...`,
      );
      contractInstance = await getContractInstanceFromContractsFolder(
        db,
        contractName,
        contractAddress,
      );
      break;

    default:
      // 'default' - get the (truffle-compiled) contract interface json from the /app/build folder. Infer the contract's address from this json file. A web3 contract instance is created from these components and assigned to contractInstance:
      logger.info(`Getting contract from contractOrigin '/app/build/'...`);
      contractInstance = await getContractInstanceFromBuildFolder(
        db,
        contractName,
        contractAddress,
      );
  }
  return contractInstance;
}

export default {
  instantiateContract,
};
