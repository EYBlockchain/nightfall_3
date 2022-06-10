/**
commitmentsync services to decrypt commitments from transaction blockproposed events
or use clientCommitmentSync to decrypt when new zkpPrivateKey is received.
*/

import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Secrets from '../classes/secrets.mjs';
import { getAllTransactions } from './database.mjs';
import { countCommitments, storeCommitment } from './commitment-storage.mjs';

const { ZERO } = config;

/**
decrypt commitments for a transaction given zkpPrivateKeys and nullifierKeys.
*/
export async function decryptCommitment(transaction, zkpPrivateKey, nullifierKey) {
  const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
  const storeCommitments = [];
  zkpPrivateKey.forEach((key, j) => {
    // decompress the secrets first and then we will decrypt the secrets from this
    const decompressedSecrets = Secrets.decompressSecrets(transaction.compressedSecrets);
    logger.info(`decompressedSecrets: ${decompressedSecrets}`);
    try {
      const commitment = Secrets.decryptSecrets(decompressedSecrets, key, nonZeroCommitments[0]);
      if (Object.keys(commitment).length === 0)
        logger.info("This encrypted message isn't for this recipient");
      else {
        // console.log('PUSHED', commitment, 'nullifierKeys', nullifierKeys[i]);
        storeCommitments.push(storeCommitment(commitment, nullifierKey[j]));
      }
    } catch (err) {
      logger.info(err);
      logger.info("This encrypted message isn't for this recipient");
    }
  });

  if (storeCommitments.length === 0) {
    throw Error("This encrypted message isn't for any of recipients");
  }
  return Promise.all(storeCommitments);
}

/**
Called when new zkpPrivateKey(s) are recieved , it fetches all available commitments
from commitments collection and decrypts commitments belonging to the new zkpPrivateKey(s).
*/
export async function clientCommitmentSync(zkpPrivateKey, nullifierKey) {
  const transactions = await getAllTransactions();
  for (let i = 0; i < transactions.length; i++) {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transactions[i].commitments.flat().filter(n => n !== ZERO);
    if (
      (transactions[i].transactionType === '1' || transactions[i].transactionType === '2') &&
      countCommitments(nonZeroCommitments) === 0
    )
      decryptCommitment(transactions[i], zkpPrivateKey, nullifierKey);
  }
}
