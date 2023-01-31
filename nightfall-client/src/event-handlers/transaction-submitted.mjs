import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';

/**
 * This handler runs whenever a new transaction is submitted to the blockchain
 */
async function transactionSubmittedEventHandler(eventParams) {
  logger.info(`rrrrrrrrrrrrrrr--- ${JSON.stringify(eventParams)}`);
  const { offchain = false, ...data } = eventParams;
  let transaction;
  transaction = data;
  transaction = await getTransactionSubmittedCalldata(data);
  transaction.blockNumber = data.blockNumber;
  transaction.transactionHashL1 = data.transactionHash;

  logger.info({
    msg: 'Client Transaction Handler - New transaction received.',
    transaction,
    offchain,
  });
}

export default transactionSubmittedEventHandler;
