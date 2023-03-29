/* eslint-disable import/no-cycle */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';
import { countCommitments, countNullifiers } from '../services/commitment-storage.mjs';
import { saveTransaction } from '../services/database.mjs';

const { ZERO } = constants;

async function doesAnyOfCommitmentsExistInDB(commitments) {
  const count = await countCommitments(commitments);
  return Boolean(count);
}

async function doesAnyOfNullifiersExistInDB(nullifiers) {
  const count = await countNullifiers(nullifiers);
  return Boolean(count);
}

/**
 * This handler runs whenever a new transaction is submitted to the blockchain
 */
async function transactionSubmittedEventHandler(eventParams) {
  const { offchain = false, ...data } = eventParams;
  let saveTxInDb = false;

  const transaction = await getTransactionSubmittedCalldata(data);
  transaction.blockNumber = data.blockNumber;
  transaction.transactionHashL1 = data.transactionHash;

  // logic: if any of non zero commitment in transaction alraedy exist in db
  // That means this transaction belong to user using this nightfall-client
  // Hence, proceed and save tx in db.
  // Note: for deposit we store commitment in transaction submit event handler,
  // similarly for transfer we store change commitment in transaction submit event handler.

  // filter out non zero commitments and nullifiers
  const nonZeroCommitments = transaction.commitments.filter(c => c !== ZERO);
  const nonZeroNullifiers = transaction.nullifiers.filter(n => n !== ZERO);

  if (await doesAnyOfCommitmentsExistInDB(nonZeroCommitments)) {
    saveTxInDb = true;
  } else if (doesAnyOfNullifiersExistInDB(nonZeroNullifiers)) {
    saveTxInDb = true;
  }

  if (saveTxInDb) {
    await saveTransaction({ ...transaction });
  }

  logger.info({
    msg: 'Client Transaction Handler - New transaction received.',
    transaction,
    offchain,
    saveTxInDb,
  });
}

export default transactionSubmittedEventHandler;
