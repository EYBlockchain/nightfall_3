import axios from 'axios';

import {
  getAllRawTxs,
  removeRawTx,
  getAllTxObjects,
  removeTxObject,
} from './utils/lib/local-storage';
import { getContractAddress, submitTransaction } from './common-files/utils/contract';

const { proposerUrl } = global.config;
let shieldContractAddress;

// this function fetch raw transaction from
// localStorage and submit them using metamask
// once successfully submitted remove from localStorage
async function submitTransactionsOnChain() {
  if (!shieldContractAddress)
    shieldContractAddress = (await getContractAddress('Shield')).data.address;

  for (const rawTx of getAllRawTxs()) {
    // eslint-disable-next-line no-await-in-loop
    await submitTransaction(rawTx, shieldContractAddress, 1).then(() => removeRawTx(rawTx));
  }
}

// this function fetch raw transaction from
// localStorage and send it to proposer for
// offchain transaction submission
async function submitTransactionOffChain() {
  if (!shieldContractAddress)
    shieldContractAddress = (await getContractAddress('Shield')).data.address;

  for (const txObj of getAllTxObjects()) {
    // eslint-disable-next-line no-await-in-loop
    await axios
      .post(
        `${proposerUrl}/proposer/offchain-transaction`,
        { transaction: txObj },
        { timeout: 3600000 },
      )
      .then(() => removeTxObject(txObj));
  }
}

setInterval(submitTransactionsOnChain, 300000); // every 5 minute
setInterval(submitTransactionOffChain, 300000); // every 5 minute
