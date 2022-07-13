/**
commitmentsync services to decrypt commitments from transaction blockproposed events
or use clientCommitmentSync to decrypt when new ivk is received.
*/

import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Secrets from '../classes/secrets.mjs';
import { getAllTransactions } from './database.mjs';
import { countCommitments, storeCommitment } from './commitment-storage.mjs';

const { ZERO } = config;

/**
decrypt commitments for a transaction given ivks and nsks.
*/
export async function decryptCommitment(transaction, ivk, nsk) {
  const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
  const storeCommitments = [];
  ivk.forEach((key, j) => {
    // decompress the secrets first and then we will decryp t the secrets from this
    const decompressedSecrets = Secrets.decompressSecrets(transaction.compressedSecrets);
    logger.info(`decompressedSecrets: ${decompressedSecrets}`);
    try {
      const commitment = Secrets.decryptSecrets(decompressedSecrets, key, nonZeroCommitments[0]);
      if (Object.keys(commitment).length === 0)
        logger.info("This encrypted message isn't for this recipient");
      else {
        console.log('PUSHED', commitment, 'nsks', nsk[j]);
        storeCommitments.push(storeCommitment(commitment, nsk[j]));
      }
    } catch (err) {
      logger.info(err);
      logger.info("This encrypted message isn't for this recipient");
    }
  });
  await Promise.all(storeCommitments).catch(function (err) {
    logger.info(err);
  });
}

/**
Called when new ivk(s) are recieved , it fetches all available commitments
from commitments collection and decrypts commitments belonging to the new ivk(s).
*/
export async function clientCommitmentSync(ivk, nsk) {
  const transactions = await getAllTransactions();
  for (let i = 0; i < transactions.length; i++) {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transactions[i].commitments.flat().filter(n => n !== ZERO);
    if (
      (transactions[i].transactionType === '1' || transactions[i].transactionType === '2') &&
      countCommitments(nonZeroCommitments) === 0
    )
      decryptCommitment(transactions[i], ivk, nsk);
  }
}
