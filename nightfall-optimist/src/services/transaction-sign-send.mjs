/* eslint-disable no-param-reassign */

import config from 'config';
import { web3 } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { estimateGas, estimateGasPrice } from '@polygon-nightfall/common-files/utils/gas.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { Mutex } from 'async-mutex';

const { GAS, GAS_MULTIPLIER, GAS_ESTIMATE_ENDPOINT, GAS_PRICE, GAS_PRICE_MULTIPLIER } = config;

const nonceMutex = new Mutex();

const isWeb3Listening = async () => {
  try {
    const isListening = await web3.eth.net.isListening();
    return isListening;
  } catch (error) {
    throw new Error(error.message);
  }
};

export async function getAddressNonce(ethAddress) {
  try {
    const nonce = await web3.eth.getTransactionCount(ethAddress);
    return nonce;
  } catch (error) {
    throw new Error(error.message);
  }
}

// TODO document
export async function createSignedTransaction(nonce, ethPrivateKey, from, to, data, value = 0) {
  // Check if web3 ws is available
  const result = await isWeb3Listening();
  if (result) {
    logger.debug('Create transaction object...');

    let signedTx;
    await nonceMutex.runExclusive(async () => {
      // Update nonce if necessary
      const _nonce = await getAddressNonce(from);
      if (nonce < _nonce) {
        nonce = _nonce;
      }
      // Estimate gasPrice
      const gasPrice = await estimateGasPrice(
        GAS_ESTIMATE_ENDPOINT,
        web3,
        GAS_PRICE,
        GAS_PRICE_MULTIPLIER,
      );
      // Eth tx
      const tx = {
        from,
        to,
        data,
        value,
        gasPrice,
        nonce,
      };
      // Estimate gas
      const gas = await estimateGas(tx, web3, GAS, GAS_MULTIPLIER);
      tx.gas = gas;

      logger.debug({ msg: 'Sign transaction...', tx });
      signedTx = await web3.eth.accounts.signTransaction(tx, ethPrivateKey);
    });

    return signedTx;
  }

  throw new Error('Web3 ws not listening, try again later');
}

export async function sendSignedTransaction(tx) {
  logger.debug({ msg: 'Send signed transaction...', tx });
  // As per https://web3js.readthedocs.io/en/v1.7.3/web3-eth.html#eth-sendtransaction-return
  return new Promise((resolve, reject) => {
    web3.eth
      .sendSignedTransaction(tx.rawTransaction)
      .then(receipt => resolve(receipt))
      .catch(error => reject(error));
  });
}
