/* eslint-disable no-param-reassign */

import config from 'config';
import { web3 } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { estimateGas, estimateGasPrice } from '@polygon-nightfall/common-files/utils/gas.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { Mutex } from 'async-mutex';

const { GAS, GAS_MULTIPLIER, GAS_ESTIMATE_ENDPOINT, GAS_PRICE, GAS_PRICE_MULTIPLIER } = config;

const nonceMutex = new Mutex();

export async function getAddressNonce(ethAddress) {
  let nonce;
  try {
    nonce = await web3.eth.getTransactionCount(ethAddress);
  } catch (err) {
    logger.error({
      msg: 'Error obtaining address nonce',
      err,
    });
  }
  return nonce;
}

// TODO check web3 ws is opened
export async function createSignedTransaction(nonce, ethPrivateKey, from, to, data, value = 0) {
  logger.debug({ msg: 'Create transaction object...' });

  let signedTx;
  await nonceMutex.runExclusive(async () => {
    // Estimate gas
    const gas = await estimateGas(data, web3, GAS, GAS_MULTIPLIER);
    // Estimate gasPrice
    const gasPrice = await estimateGasPrice(
      GAS_ESTIMATE_ENDPOINT,
      web3,
      GAS_PRICE,
      GAS_PRICE_MULTIPLIER,
    );
    // Update nonce if necessary
    const _nonce = await getAddressNonce(from);
    if (nonce < _nonce) {
      nonce = _nonce;
    }

    const tx = {
      from,
      to,
      data,
      value,
      gas,
      gasPrice,
      nonce,
    };
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
