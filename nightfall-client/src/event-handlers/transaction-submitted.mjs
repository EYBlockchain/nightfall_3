import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';
import { zkpPrivateKeys, nullifierKeys } from '../services/keys.mjs';
import { decryptCommitment } from '../services/commitment-sync.mjs';

/**
 * This handler runs whenever a new transaction is submitted to the blockchain
 */
async function transactionSubmittedEventHandler(eventParams) {
  logger.info(`rrrrrrrrrrrrrrr--- ${JSON.stringify(eventParams)}`);
  const { offchain = false, ...data } = eventParams;
  let transaction;
  transaction = data;
  logger.info(`rrrrrrr11111rrrrrrrr--- ${JSON.stringify(transaction)}`);
  transaction = await getTransactionSubmittedCalldata(data);
  transaction.blockNumber = data.blockNumber;
  transaction.transactionHashL1 = data.transactionHash;

  const transactionDecrypted = await decryptCommitment(transaction, zkpPrivateKeys, nullifierKeys);

  logger.info({
    msg: 'Client Transaction Handler - New transaction received.',
    transaction,
    offchain,
    transactionDecrypted,
  });
}

export default transactionSubmittedEventHandler;
