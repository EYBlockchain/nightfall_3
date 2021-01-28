import logger from '../utils/logger.mjs';
import { isRegisteredProposerAddressMine } from '../services/database.mjs';
/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function newCurrentProposerEventHandler(data) {
  const { proposer } = data.returnValues;
  logger.info('Received NewCurrentProposer event');
  try {
    logger.info(`New current proposer is ${proposer}`);
    if (isRegisteredProposerAddressMine(proposer))
      logger.info('This is one of my proposer addresses');
    // do something
  } catch (err) {
    // handle errors
    logger.error(err);
    throw new Error(err); // pass error handling up the call stack
  }
}

export default newCurrentProposerEventHandler;
