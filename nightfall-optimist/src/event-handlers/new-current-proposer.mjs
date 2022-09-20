import logger from 'common-files/utils/logger.mjs';
import Block from '../classes/block.mjs';
import {
  isRegisteredProposerAddressMine,
  resetUnsuccessfulBlockProposedTransactions,
} from '../services/database.mjs';

/**
 * This handler runs whenever a BlockProposed event is emitted by the blockchain
 */
async function newCurrentProposerEventHandler(data, args) {
  const { proposer: currentProposer } = data.returnValues;
  const [proposer] = args;
  try {
    logger.info({ message: 'Proposer Handler', currentProposer });

    /*
     remember the current proposer.  We don't store it in the DB as it's an
     ephemeral thing. Instead, we have an object to remember it. The
     object is instantiated at the 'main()' level, so will stay in scope even
     when this handler exits.
     */
    proposer.address = currentProposer;

    // were we the last proposer?
    const weWereLastProposer = proposer.isMe;

    // If we were the last proposer return any transactions that were removed from the mempool
    // because they were included in proposed blocks that did not eventually make it on chain.
    if (weWereLastProposer) {
      Block.rollback();
      await resetUnsuccessfulBlockProposedTransactions();
    }

    // !! converts this to a "is not null" check - i.e. false if is null
    // are we the next proposer?
    proposer.isMe = !!(await isRegisteredProposerAddressMine(currentProposer));
  } catch (err) {
    // handle errors
    logger.error(err);
    throw new Error(err); // pass error handling up the call stack
  }
}

export default newCurrentProposerEventHandler;
