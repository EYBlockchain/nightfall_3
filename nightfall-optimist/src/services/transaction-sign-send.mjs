/* eslint-disable no-param-reassign */

import config from 'config';
import { web3 } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { estimateGas, estimateGasPrice } from '@polygon-nightfall/common-files/utils/gas.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { Mutex } from 'async-mutex';

const { GAS, GAS_MULTIPLIER, GAS_ESTIMATE_ENDPOINT, GAS_PRICE, GAS_PRICE_MULTIPLIER } = config;

const nonceMutex = new Mutex();

// TODO document
export async function createSignedTransaction(ethPrivateKey, from, to, data, value = 0) {
  // Check if web3 ws is available
  const isListening = await web3.eth.net.isListening();
  if (!isListening) throw new Error('Web3 ws not listening, try again later');

  logger.debug('Create transaction object...');

  let signedTx;
  await nonceMutex.runExclusive(async () => {
    // Get nonce
    const nonce = await web3.eth.getTransactionCount(from);
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
