import { web3 } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { estimateGas, estimateGasPrice } from '@polygon-nightfall/common-files/utils/gas.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import app from '../app.mjs';
import {
  GAS,
  GAS_MULTIPLIER,
  GAS_ESTIMATE_ENDPOINT,
  GAS_PRICE,
  GAS_PRICE_MULTIPLIER,
} from '../../../cli/lib/constants.mjs';

// TODO check web3 ws is opened
export async function createSignedTransaction(to, data, value = 0) {
  logger.debug({ msg: 'Create transaction object...' });

  const ethPrivateKey = app.get('ethPrivateKey');
  const from = app.get('ethAddress');
  const gas = await estimateGas(data, web3, GAS, GAS_MULTIPLIER);
  const gasPrice = await estimateGasPrice(
    GAS_ESTIMATE_ENDPOINT,
    web3,
    GAS_PRICE,
    GAS_PRICE_MULTIPLIER,
  );
  const tx = {
    from,
    to,
    data,
    value,
    gas,
    gasPrice,
  };

  logger.debug({ msg: 'Sign transaction...', tx });
  return await web3.eth.accounts.signTransaction(tx, ethPrivateKey);
}

export async function sendSignedTransaction(tx) {
  return new Promise((resolve, reject) => {
    this.web3.eth
      .sendSignedTransaction(tx.rawTransaction)
      .then(receipt => resolve(receipt))
      .catch(error => reject(error));
  });
}
