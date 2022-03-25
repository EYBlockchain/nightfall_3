/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

import fs from 'fs';
import config from 'config';

import Web3Payments from './web3Payments.mjs';
import logger from './logger.mjs';

export const web3 = Web3Payments.connection();

const options = config.WEB3_OPTIONS;

export const contractPath = contractName => {
  return `${config.CONTRACT_ARTIFACTS}/${contractName}.json`;
};

export async function getContractInterface(contractName) {
  const path = contractPath(contractName);
  const contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
  // logger.silly('\ncontractInterface:', contractInterface);
  return contractInterface;
}

export async function getContractAddress(contractName) {
  let deployedAddress;
  const contractInterface = await getContractInterface(contractName);

  const networkId = await web3.eth.net.getId();
  logger.silly('networkId:', networkId);

  if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
    deployedAddress = contractInterface.networks[networkId].address;
  }
  logger.silly('deployed address:', deployedAddress);
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
  // logger.silly('\ncontractInstance:', contractInstance);

  return contractInstance;
}

export async function getContractPaymentsAddress(contractName) {
  let deployedAddress;
  const contractInterface = await getContractInterface(contractName);

  const networkId = await web3.eth.net.getId();
  logger.silly('networkId:', networkId);

  if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
    deployedAddress = contractInterface.networks[networkId].address;
  }
  logger.silly('deployed address:', deployedAddress);
  return deployedAddress;
}
