import logger from '../utils/logger.mjs';
import { markNullifiedOnChain, markOnChain } from '../services/commitment-storage.mjs';
import getProposeBlockCalldata from '../services/process-calldata.mjs';

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  const { nullifiers, blockNumberL2, commitments } = await getProposeBlockCalldata(data);
  if (nullifiers.length)
    logger.debug(
      `Nullifiers appeared on chain at block number ${blockNumberL2}, ${JSON.stringify(
        nullifiers,
        null,
        2,
      )}`,
    );
  if (commitments.length)
    logger.debug(
      `Commitments appeared on chain at block number ${blockNumberL2}, ${JSON.stringify(
        commitments,
        null,
        2,
      )}`,
    );
  // mark commitments on chain
  markOnChain(commitments, blockNumberL2);

  // these nullifiers have now appeared on-chain. Thus their nullification
  // has been confirmed (barring a rollback) and we need to update the
  // commitment database to that effect
  markNullifiedOnChain(nullifiers, blockNumberL2);
}

export default blockProposedEventHandler;
