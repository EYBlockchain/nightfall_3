/* eslint import/no-extraneous-dependencies: "off" */

import Web3 from 'web3';
import config from 'config';
import logger from './logger.mjs';

export default {
  connection() {
    if (!this.web3) this.connect();
    return this.web3;
  },

  /**
   * Connects to web3 and then sets proper handlers for events
   */
  connect() {
    if (this.web3) return this.web3.currentProvider;

    logger.info(`Blockchain Connecting on ${config.BLOCKCHAIN_URL}...`);

    const provider = new Web3.providers.WebsocketProvider(
      config.BLOCKCHAIN_URL,
      config.WEB3_PROVIDER_OPTIONS,
    );

    provider.on('error', err => logger.error(`web3 error: ${err}`));
    provider.on('connect', () => logger.info('Blockchain Connected ...'));
    provider.on('end', () => logger.info('Blockchain disconnected'));

    this.web3 = new Web3(provider);

    return provider;
  },

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
  },
  disconnect() {
    this.web3.currentProvider.connection.close();
  },

  async estimateGas(tx) {
    let gas;
    try {
      gas = await this.web3.eth.estimateGas(tx);
      logger.debug({ msg: 'Gas estimated at', gas });
    } catch (error) {
      gas = config.WEB3_OPTIONS.gas;
      logger.warn({ msg: 'Gas estimation failed, use default', gas });
    }
    gas = Math.ceil(gas * 2); // 50% seems a more than reasonable buffer
    return gas;
  },

  // function only needed for infura deployment
  async submitRawTransaction(rawTransaction, contractAddress, value = 0) {
    if (!rawTransaction) throw Error('No tx data to sign');
    if (!contractAddress) throw Error('No contract address passed');
    if (!config.WEB3_OPTIONS.from) throw Error('config WEB3_OPTIONS.from is not set');
    if (!config.ETH_PRIVATE_KEY) throw Error('config ETH_PRIVATE_KEY not set');

    const fromAddress = await this.web3.eth.accounts.privateKeyToAccount(config.ETH_PRIVATE_KEY);

    const tx = {
      from: fromAddress.address,
      to: contractAddress,
      data: rawTransaction,
      value,
      gasPrice: config.WEB3_OPTIONS.gasPrice,
    };
    tx.gas = await this.estimateGas(tx);

    const signed = await this.web3.eth.accounts.signTransaction(tx, config.ETH_PRIVATE_KEY);
    return this.web3.eth.sendSignedTransaction(signed.rawTransaction);
  },
};
