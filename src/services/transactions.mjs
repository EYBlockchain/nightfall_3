/**
 * module for maintaining a list of viable transactions. i.e. ones that have
 * been posted by a user but not picked up by a Proposer.
 */
import gen from 'general-number';
// import { depositTransactionEmitter, proposalBlockEmitter } from '../utils/event-emitters';
import sha256 from '../utils/crypto/sha256.mjs';
import {
  subscribeToDepositTransactionEvents,
  subscribeToProposalBlockEvents,
  // subscribeToAcceptedProposalEvents,
  // subscribeToRejectedProposalEvents,
} from '../utils/event-emitters.mjs';
import logger from '../utils/logger.mjs';

const { generalise } = gen;

/**
 * This function maintains the transactions map: adding new transaction events
 * and removing ones that a Proposer has proposed.
 */
function maintainTransactionsMap() {
  const transactions = new Map();
  subscribeToDepositTransactionEvents(event => {
    logger.silly(`DepositTransactionCreated Event ${JSON.stringify(event, null, 2)}`);
    const transactionData = generalise(event.returnValues);
    logger.silly(`hash inputs were ${JSON.stringify(transactionData, null, 2)}`);
    const hash = sha256([
      transactionData.fee,
      transactionData.publicInputHash,
      transactionData.tokenId,
      transactionData.value,
      transactionData.ercAddress,
      transactionData.commitment,
      ...transactionData.proof,
    ]);
    const transaction = { hash, ...transactionData };
    transactions.set(transaction.hash, transaction);
    logger.info(`Heard a new deposit transaction with hash ${transaction.hash.hex()}`);
    if (transactionData.transactionHash.hex() === hash.hex())
      logger.info('Local hash calculation agrees with blockchain');
    else
      logger.error(
        `Locally calculated hash was ${hash.hex()} but Event hash was ${transactionData.transactionHash.hex()}`,
      );
  });
  subscribeToProposalBlockEvents(event => {
    const blockData = generalise(event.returnValues);
    // remove any transactions that are in the block as they're already picked
    blockData.transactionHashes.forEach(hash => {
      if (transactions.get(hash)) {
        logger.info(`Transaction ${transactions.get(hash)} has been proposed`);
        transactions.delete(hash);
      }
    });
  });
  return transactions;
}

export default maintainTransactionsMap;
