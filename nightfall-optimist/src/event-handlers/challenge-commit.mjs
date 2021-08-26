import logger from 'common-files/utils/logger.mjs';
import { revealChallenge } from '../services/challenges.mjs';
import { getCommit, isChallengerAddressMine } from '../services/database.mjs';

async function committedToChallengeEventHandler(data) {
  const { commitHash, sender } = data.returnValues;
  logger.debug(
    `Received commmitted to challenge event, with hash ${commitHash} and sender ${sender}`,
  );
  if (!isChallengerAddressMine(sender)) return; // it's not us - nothing to do
  logger.info(`Our challenge commitment has been mined, sending reveal`);
  const { txDataToSign, retrieved } = await getCommit(commitHash);
  if (txDataToSign === null) throw new Error('Commit hash not found in database');
  // if retrieved is true, then we've looked up this commit before and we assume
  // we have already revealed it - thus we don't reveal it again because that would
  // just waste gas.  This could happen if a chain reorg were to re-emit the
  // CommittedToChallenge event.
  if (!retrieved) revealChallenge(txDataToSign);
}

export default committedToChallengeEventHandler;
