import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import {
  isRegisteredProposerAddressMine,
  addTransactionsToMemPoolFromBlockNumberL2,
} from '../services/database.mjs';

const { STATE_CONTRACT_NAME } = config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/

async function newCurrentProposerEventHandler(data, args) {
  const { proposer: currentProposer } = data.returnValues;
  const [proposer] = args;
  try {
    logger.info(`Proposer Handler - Current proposer is ${currentProposer}`);
    // remember the current proposer.  We don't store it in the DB as it's an
    // ephemeral thing. Instead, we have an object to remember it. The
    // object is instantiated at the 'main()' level, so will stay in scope even
    // when this handler exits.
    proposer.address = currentProposer;
    proposer.proposers.push(currentProposer); // useful if we need to revert the proposer because of a chain reorg.
    // were we the last proposer?
    const weWereLastProposer = proposer.isMe;

    // If we were the last proposer return any transactions that were removed from the mempool
    // because they were included in proposed blocks that did not eventually make it on chain.
    if (weWereLastProposer && !proposer.isMe) {
      const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
      const onChainBlockCount = Number(
        await stateContractInstance.methods.getNumberOfL2Blocks().call(),
      );
      // All transactions greater or equal to this block count need to be reset.
      logger.info(`Resetting Transactions from :${onChainBlockCount}`);
      await addTransactionsToMemPoolFromBlockNumberL2(onChainBlockCount);
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
