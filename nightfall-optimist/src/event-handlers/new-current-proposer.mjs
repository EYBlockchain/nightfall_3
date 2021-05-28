import logger from '../utils/logger.mjs';
import { isRegisteredProposerAddressMine } from '../services/database.mjs';
/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/

async function newCurrentProposerEventHandler(data, args) {
  const { proposer: currentProposer } = data.returnValues;
  const [proposer] = args;
  try {
    logger.info(`Proposer Handler - Current proposer is ${currentProposer}`);
    // remember the current proposer.  We don't store it in the DB as it's an
    // ephemeral thing. Instead, we have a nice object to remember it. The
    // object is instantiated at the 'main()' level, so will stay in scope even
    // when this handler exits.
    proposer.address = currentProposer;
    proposer.isMe = !!(await isRegisteredProposerAddressMine(currentProposer));
  } catch (err) {
    // handle errors
    logger.error(err);
    throw new Error(err); // pass error handling up the call stack
  }
}
export default newCurrentProposerEventHandler;
