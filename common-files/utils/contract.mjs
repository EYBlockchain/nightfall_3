/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

import fs from 'fs';
import config from 'config';

import Web3 from './web3.mjs';
import logger from './logger.mjs';

export const web3 = Web3.connection();

const options = config.WEB3_OPTIONS;

export const contractPath = contractName => {
  return `${config.CONTRACT_ARTIFACTS}/${contractName}.json`;
};

export async function getContractInterface(contractName) {
  const path = contractPath(contractName);
  const contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
  // logger.trace('\ncontractInterface:', contractInterface);
  return contractInterface;
}

export async function getContractAddress(contractName) {
  let deployedAddress;
  const contractInterface = await getContractInterface(contractName);
  const networkId = await web3.eth.net.getId();
  if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
    deployedAddress = contractInterface.networks[networkId].address;
  }
  return deployedAddress;
}

// returns a web3 contract instance
export async function getContractInstance(contractName, deployedAddress) {
  // grab a 'from' account if one isn't set
  if (!options.from) {
    const accounts = await web3.eth.getAccounts();
    logger.debug('blockchain accounts are: ', accounts);
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
  // logger.trace('\ncontractInstance:', contractInstance);

  return contractInstance;
}

export async function getContractBytecode(contractName) {
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
      // logger.trace('deployed contract instance:', deployedContractInstance);
      logger.info(
        `${contractName} contract deployed at address ${deployedContractInstance.options.address}`,
      ); // instance with the new contract address

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
  while (errorCount < 600) {
    try {
      error = undefined;
      const address = await getContractAddress(contractName); // eslint-disable-line no-await-in-loop
      if (address === undefined) throw new Error(`${contractName} contract address was undefined`);
      instance = getContractInstance(contractName, address);
      return instance;
    } catch (err) {
      error = err;
      errorCount++;
      logger.warn(`Unable to get a ${contractName} contract instance will try again in 3 seconds`);
      await new Promise(resolve => setTimeout(() => resolve(), 3000)); // eslint-disable-line no-await-in-loop
    }
  }
  if (error) throw error;
  return instance;
}
