import logger from 'common-files/utils/logger.mjs';
import { revealChallenge } from '../services/challenges.mjs';
import { getCommit } from '../services/database.mjs';

async function committedToChallengeEventHandler(data) {
  const { commitHash, sender } = data.returnValues;

  logger.debug({
    msg: 'Received commmitted to challenge event',
    commitHash,
    sender,
  });

  logger.info('A challenge commitment has been mined');

  const { txDataToSign, retrieved } = await getCommit(commitHash);

  // We may not find the commitment. In this case, it's probably not ours so we take no action
  if (txDataToSign === null) {
    logger.debug('Commit hash not found in database');
    return;
  }

  /*
   if retrieved is true, then we've looked up this commit before and we assume
   we have already revealed it - thus we don't reveal it again because that would
   just waste gas.  This could happen if a chain reorg were to re-emit the
   CommittedToChallenge event.
  */
  if (!retrieved) revealChallenge(txDataToSign, sender);
}

export default committedToChallengeEventHandler;
