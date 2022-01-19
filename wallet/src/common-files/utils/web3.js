// ignore unused exports default

import Web3 from 'web3';
import logger from './logger';

const { INFURA_PROJECT_SECRET } = process.env;
const { USE_INFURA, BLOCKCHAIN_URL, WEB3_PROVIDER_OPTIONS, WEB3_OPTIONS, ETH_PRIVATE_KEY } =
  global.config;

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

    logger.info('Blockchain Connecting ...');

    let provider;
    if (USE_INFURA) {
      if (!INFURA_PROJECT_SECRET) throw Error('env INFURA_PROJECT_SECRET not set');

      provider = new Web3.providers.WebsocketProvider(BLOCKCHAIN_URL, {
        ...WEB3_PROVIDER_OPTIONS,
        headers: {
          authorization: `Basic ${Buffer.from(`:${INFURA_PROJECT_SECRET}`).toString('base64')}`,
        },
      });
    } else {
      provider = new Web3.providers.WebsocketProvider(BLOCKCHAIN_URL, WEB3_PROVIDER_OPTIONS);
    }

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

  // function only needed for infura deployment
  async submitRawTransaction(rawTransaction, contractAddress, value = 0) {
    if (!rawTransaction) throw Error('No tx data to sign');
    if (!contractAddress) throw Error('No contract address passed');
    if (!WEB3_OPTIONS.from) throw Error('WEB3_OPTIONS.from is not set');
    if (!ETH_PRIVATE_KEY) throw Error('ETH_PRIVATE_KEY not set');

    const tx = {
      to: contractAddress,
      data: rawTransaction,
      value,
      gas: WEB3_OPTIONS.gas,
      gasPrice: WEB3_OPTIONS.gasPrice,
    };

    const signed = await this.web3.eth.accounts.signTransaction(tx, ETH_PRIVATE_KEY);
    return this.web3.eth.sendSignedTransaction(signed.rawTransaction);
  },
};
