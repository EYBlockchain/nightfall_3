/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

import fs from 'fs';
import config from 'config';

import Web3 from './web3.mjs';
import logger from './logger.mjs';

export const web3 = Web3.connection();

const retries = config.RETRIES;
const options = config.WEB3_OPTIONS;

let cachedContracts = {};

const contractPath = contractName => {
  return `${config.CONTRACT_ARTIFACTS}/${contractName}.json`;
};

/**
 * Function returns the interface of a contract. First time interface is retrieved, it is cached.
 * @param {String} contractName - Name of Smart Contract
 * @returns {String} - contract interface
 */
async function getContractInterface(contractName) {
  if (contractName in cachedContracts) {
    return cachedContracts[contractName];
  }
  const path = contractPath(contractName);
  const contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
  cachedContracts[contractName] = contractInterface;
  return contractInterface;
}

export async function clearCachedContracts() {
  cachedContracts = {};
}

export async function getContractAddress(contractName) {
  let deployedAddress;
  const contractInterface = await getContractInterface(contractName);
  const networkId = config.ENVIRONMENTS[config.ENVIRONMENT].chainId || 1337; // await web3.eth.getChainId();
  if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
    deployedAddress = contractInterface.networks[networkId].address;
  }
  return deployedAddress;
}

export async function getContractAbi(contractName) {
  let abi;
  const contractInterface = await getContractInterface(contractName);
  if (contractInterface) {
    abi = contractInterface.abi;
  }
  return abi;
}

// returns a web3 contract instance
export async function getContractInstance(contractName, deployedAddress) {
  // grab a 'from' account if one isn't set
  if (!options.from) {
    let accounts;
    if (config.ETH_PRIVATE_KEY) {
      accounts = [web3.eth.accounts.privateKeyToAccount(config.ETH_PRIVATE_KEY).address];
      logger.debug(`Account derived from private key ${accounts[0]}`);
    } else accounts = await web3.eth.getAccounts(); // this is a last resort and only works if the node holds an account

    logger.trace({
      msg: 'blockchain accounts',
      accounts,
    });

    [options.from] = accounts;
  }
  const contractInterface = await getContractInterface(contractName);
  if (!deployedAddress) {
    // eslint-disable-next-line no-param-reassign
    deployedAddress = await getContractAddress(contractName);
  }

  const contractInstance = deployedAddress
    ? new web3.eth.Contract(contractInterface.abi, deployedAddress, options)
    : new web3.eth.Contract(contractInterface.abi, options);

  return contractInstance;
}

async function getContractBytecode(contractName) {
  const contractInterface = await getContractInterface(contractName);
  return contractInterface.evm.bytecode.object;
}

export async function deploy(contractName, constructorParams, { from, gas, password }) {
  logger.info(`\nUnlocking account ${from}...`);
  await web3.eth.personal.unlockAccount(from, password, 1);

  const contractInstance = await getContractInstance(contractName); // get a web3 contract instance of the contract
  const bytecode = await getContractBytecode(contractName);

  const deployedContractAddress = await contractInstance
    .deploy({ data: `0x${bytecode}`, arguments: constructorParams })
    .send({
      from,
      gas,
    })
    .on('error', err => {
      throw new Error(err);
    })
    .then(deployedContractInstance => {
      logger.info({
        msg: 'Contract deployed',
        contractName,
        address: deployedContractInstance.options.address,
      }); // instance with the new contract address

      return deployedContractInstance.options.address;
    });
  return deployedContractAddress;
}

/**
 * Function that tries to get a (named) contract instance and, if it fails, will
 * retry after 3 seconds.  After RETRIES attempts, it will give up and throw.
 * This is useful in case nightfall-optimist comes up before the contract
 * is fully deployed.
 */
export async function waitForContract(contractName) {
  let errorCount = 0;
  let error;
  let instance;
  while (errorCount < retries) {
    try {
      error = undefined;
      const address = await getContractAddress(contractName); // eslint-disable-line no-await-in-loop
      logger.debug(`contract address was ${address}`);
      if (address === undefined) {
        // contract was cached when retrieving address, so we need to clear
        delete cachedContracts[contractName];
        throw new Error(`${contractName} contract address was undefined`);
      }
      instance = await getContractInstance(contractName, address); // eslint-disable-line no-await-in-loop
      return instance;
    } catch (err) {
      error = err;
      errorCount++;

      logger.warn({
        msg: 'Unable to get contract instance, retrying in 3 secs',
        contractName,
      });

      await new Promise(resolve => setTimeout(() => resolve(), 3000)); // eslint-disable-line no-await-in-loop
    }
  }
  if (error) throw error;

  return instance;
}
