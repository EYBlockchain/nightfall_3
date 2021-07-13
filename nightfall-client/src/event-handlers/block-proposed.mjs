import { generalise, GN } from 'general-number';
import logger from '../utils/logger.mjs';
import { markNullifiedOnChain, storeCommitment } from '../services/commitment-storage.mjs';
import getProposeBlockCalldata from '../services/process-calldata.mjs';
import { dec, edwardsDecompress } from '../utils/crypto/encryption/elgamal.mjs';
import Commitment from '../classes/commitment.mjs';
import { calculatePkd } from '../services/keys.mjs';

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, ivk) {
  let { nullifiers, blockNumberL2, encryptedSecrets } = await getProposeBlockCalldata(data);
  if (nullifiers.length)
    logger.debug(
      `Nullifiers appeared on chain at block number ${blockNumberL2}, ${JSON.stringify(
        nullifiers,
        null,
        2,
      )}`,
    );
  encryptedSecrets = generalise(encryptedSecrets).map(encryptedSecret => {
    return edwardsDecompress(encryptedSecret.bigInt);
  });
  const decryptedMessages = dec(encryptedSecrets, ivk);
  const ercAddress = decryptedMessages[0];
  const tokenId = decryptedMessages[1];
  const value = decryptedMessages[2];
  const salt = decryptedMessages[3];
  const { pkd, compressedPkd } = await calculatePkd(new GN(ivk));
  const commitment = new Commitment({
    compressedPkd,
    pkd,
    ercAddress,
    tokenId,
    value,
    salt,
  });
  await storeCommitment(commitment, ivk);
  // these nullifiers have now appeared on-chain. Thus their nullification
  // has been confirmed (barring a rollback) and we need to update the
  // commitment database to that effect
  markNullifiedOnChain(nullifiers, blockNumberL2);
}

export default blockProposedEventHandler;
