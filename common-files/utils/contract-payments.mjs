/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

import fs from 'fs';
import config from 'config';

import Web3Payments from './web3Payments.mjs';
import logger from './logger.mjs';

export const web3 = Web3Payments.connection();

export const contractPath = contractName => {
  return `${config.CONTRACT_ARTIFACTS}/${contractName}.json`;
};

async function getContractInterface(contractName) {
  const path = contractPath(contractName);
  const contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
  // logger.silly('\ncontractInterface:', contractInterface);
  return contractInterface;
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
