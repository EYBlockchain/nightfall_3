import { revealChallenge } from '../services/challenges.mjs';
import { getCommit, isChallengerAddressMine } from '../services/database.mjs';
import logger from '../utils/logger.mjs';

async function committedToChallengeEventHandler(data) {
  const { commitHash, sender } = data.returnValues;
  logger.debug(
    `Received commmitted to challenge event, with hash ${commitHash} and sender ${sender}`,
  );
  if (!isChallengerAddressMine(sender)) return; // it's not us - nothing to do
  logger.info(`Our challenge commitment has been mined, sending reveal`);
  const { txDataToSign } = await getCommit(commitHash);
  if (txDataToSign === null) throw new Error('Commit hash not found in database');
  revealChallenge(txDataToSign);
}

export default committedToChallengeEventHandler;
