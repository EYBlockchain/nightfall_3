import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { revealChallenge } from '../services/challenges.mjs';
import { getCommit } from '../services/database.mjs';

async function committedToChallengeEventHandler(data) {
  const { commitHash, sender } = data.returnValues;

  logger.debug({
    msg: 'Received CommittedToChallenge event',
    commitHash,
    sender,
  });
  logger.info('A challenge commitment has been mined');

  const commitData = await getCommit(commitHash);
  // We may not find the commitment (probably not ours), so we take no action
  if (commitData === null) {
    logger.debug('Commit hash not found in database');
    return;
  }

  // If `retrieved` is true, then we've looked up this commit before and we assume
  // we have already revealed it so we take no action.
  // This could happen if a chain reorg were to re-emit the
  // CommittedToChallenge event.
  const { txDataToSign, retrieved } = commitData;
  if (!retrieved) revealChallenge(txDataToSign, sender);
}

export default committedToChallengeEventHandler;
