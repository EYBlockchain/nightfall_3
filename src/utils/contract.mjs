import fs from 'fs';
import config from 'config';

import Web3 from './web3.mjs';
import logger from './logger.mjs';

const web3 = Web3.connection();

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
  if (!contractInstance) throw new Error('Contract instance null or undefined');

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
      // logger.silly('deployed contract instance:', deployedContractInstance);
      logger.info(
        `${contractName} contract deployed at address ${deployedContractInstance.options.address}`,
      ); // instance with the new contract address

      return deployedContractInstance.options.address;
    });
  return deployedContractAddress;
}
