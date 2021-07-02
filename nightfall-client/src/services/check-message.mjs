/**
 * Function for checking that a commitment that has been transferred to a
 * receiving party is valid.  For off-chain messaging, or on-chain messaging
 * that does not enforce a proof of correctness, we need to check that the
 * commitment that is re-created from the message exists 'on-chain'.
 * Note that the commitment may not actually still be saved on-chain and so we
 * will, in fact, refer to our Timber instance for confirmation (this is much
 * faster than searching all historical NewLeaf or NewLeaves events).
 * One thing to watch is that Timber may not yet have updated with the latest
 * event data, if the transaction was very recent, and so we need to make sure
 * we have waited long enough before we call foul. This function does not
 * address that problem; it's up to the caller to solve (e.g. by retrying).
 * Likewise, this function makes no assumptions about how we got the message,
 * because that is implementation dependent.  It does however enforce the
 * message object's structure, as defined in the message param below. Thus any
 * preprossesing of the message (decryption, header and metadata removal) must
 * be done by the message-receiving infrastructure.
 *
 * This function is NOT required for on-chain messaging methods, that enforce a
 * proof of correctness on the message, because the message is provably correct.
 * @param {object} message - {ercAddress, tokenId, value, salt }
 * @param {general-number} recipientZkpPublicKey - public key of receiving party
 * @return {boolean}
 */

import Commitment from '../classes/commitment.mjs';

async function isMessageValid(message, recipientZkpPublicKey) {
  const commitment = new Commitment({
    zkpPublicKey: recipientZkpPublicKey,
    ...message,
  });
  if ((await commitment.index) === null) return false;
  return true;
}

export default isMessageValid;
