import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import {
  markNullifiedOnChain,
  markOnChain,
  storeCommitment,
} from '../services/commitment-storage.mjs';
import getProposeBlockCalldata from '../services/process-calldata.mjs';
import Secrets from '../classes/secrets.mjs';

const { ZERO } = config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, keys = [ZERO, ZERO]) {
  logger.info(`Received Block Proposed event`);
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const ivk = keys[0];
  const nsk = keys[1];
  const { commitments, nullifiers, blockNumberL2, compressedSecrets } =
    await getProposeBlockCalldata(data);

  if (nullifiers.length)
    logger.debug(
      `Nullifiers appeared on chain at block number ${blockNumberL2}, ${JSON.stringify(
        nullifiers,
        null,
        2,
      )}`,
    );

  // filter out non zero commitmentsCount
  const nonZeroCommitments = commitments.flat().filter(n => n !== ZERO);

  // mark commitments on chain
  await markOnChain(nonZeroCommitments, blockNumberL2);

  compressedSecrets.forEach(async (compressedSecret, i) => {
    // if there are no compressed secrets in a transaction, then we will ignore it as these could be deposit or
    // withdraw transactions which do not hold secrets that need to be decrypted
    if (
      !compressedSecret.every(
        item => item === '0x0000000000000000000000000000000000000000000000000000000000000000',
      )
    ) {
      // decompress the secrets first and then we will decrypt the secrets from this
      const decompressedSecrets = Secrets.decompressSecrets(compressedSecret);
      try {
        const commitment = Secrets.decryptSecrets(decompressedSecrets, ivk, commitments[i][0]);
        if (commitment === {}) logger.error("This encrypted message isn't for this recipient");
        // store commitment if the new commitment in this transaction is intended for this client
        else await storeCommitment(commitment, nsk);
      } catch (err) {
        logger.error(err);
        logger.error("This encrypted message isn't for this recipient");
      }
    }
  });

  // these nullifiers have now appeared on-chain. Thus their nullification
  // has been confirmed (barring a rollback) and we need to update the
  // commitment database to that effect
  await markNullifiedOnChain(nullifiers, blockNumberL2);
}

export default blockProposedEventHandler;
