/* eslint import/no-extraneous-dependencies: "off" */

import Web3 from 'web3';
import config from 'config';
import fs from 'fs';
import logger from './logger.mjs';

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

  if (contractInterface) {
    // eslint-disable-next-line prefer-destructuring
    deployedAddress = Object.keys(contractInterface.networks).map(network => {
      return { contractName, network, address: contractInterface.networks[network].address };
    })[0];
  }
  logger.debug('deployed address:', deployedAddress);
  return deployedAddress;
}

export default class W3 {
  constructor(url, providerOptions) {
    /**
     * Connects to web3 and then sets proper handlers for events
     */
    if (this.web3) return this.web3.currentProvider;

    logger.info('Blockchain Connecting ...');

    const provider = new Web3.providers.WebsocketProvider(url, providerOptions);

    provider.on('error', err => logger.error(`web3 error: ${err}`));
    provider.on('connect', () => logger.info('Blockchain Connected ...'));
    provider.on('end', () => logger.info('Blockchain disconnected'));

    this.web3 = new Web3(provider);
  }

  /**
   *
   * @returns Underlying web3 instance
   */
  getWeb3() {
    return this.web3;
  }

  /**
   * Checks the status of connection
   *
   * @return {Boolean} - Resolves to true or false
   */
  isConnected() {
    if (this.web3) {
      return this.web3.eth.net.isListening();
    }
    return false;
  }

  disconnect() {
    this.web3.currentProvider.connection.close();
  }

  // function only needed for infura deployment
  async submitRawTransaction(rawTransaction, contractAddress, value = 0) {
    if (!rawTransaction) throw Error('No tx data to sign');
    if (!contractAddress) throw Error('No contract address passed');
    if (!options.from) throw Error('config WEB3_OPTIONS.from is not set');
    if (!config.ETH_PRIVATE_KEY) throw Error('config ETH_PRIVATE_KEY not set');

    const tx = {
      to: contractAddress,
      data: rawTransaction,
      value,
      gas: config.WEB3_OPTIONS.gas,
      gasPrice: config.WEB3_OPTIONS.gasPrice,
    };

    const signed = await this.web3.eth.accounts.signTransaction(tx, config.ETH_PRIVATE_KEY);
    return this.web3.eth.sendSignedTransaction(signed.rawTransaction);
  }

  async getContractInstance(contractName, deployedAddress) {
    // grab a 'from' account if one isn't set
    if (!options.from) {
      const accounts = await this.web3.eth.getAccounts();
      logger.debug('blockchain accounts are: ', accounts);
      [options.from] = accounts;
    }
    const contractInterface = await getContractInterface(contractName);
    if (!deployedAddress) {
      // eslint-disable-next-line no-param-reassign
      deployedAddress = (await getContractAddress(contractName)).address;
    }

    const contractInstance = deployedAddress
      ? new this.web3.eth.Contract(contractInterface.abi, deployedAddress, options)
      : new this.web3.eth.Contract(contractInterface.abi, options);
    // logger.silly('\ncontractInstance:', contractInstance);

    return contractInstance;
  }
}
export const web3 = new W3(config.BLOCKCHAIN_URL, config.WEB3_PROVIDER_OPTIONS);

export const web3Payments = new W3(config.BLOCKCHAIN_PAYMENTS_URL, config.WEB3_PROVIDER_OPTIONS);
