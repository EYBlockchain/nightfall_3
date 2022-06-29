/**
commitmentsync services to decrypt commitments from transaction blockproposed events
or use clientCommitmentSync to decrypt when new zkpPrivateKey is received.
*/

import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { generalise } from 'general-number';
import { getAllTransactions } from './database.mjs';
import { countCommitments, storeCommitment } from './commitment-storage.mjs';
import { decrypt, packSecrets } from './kem-dem.mjs';
import { ZkpKeys } from './keys.mjs';
import Commitment from '../classes/commitment.mjs';
import { edwardsDecompress } from '../utils/crypto/encryption/elgamal.mjs';

const { ZERO } = config;

/**
decrypt commitments for a transaction given zkpPrivateKeys and nullifierKeys.
*/
export async function decryptCommitment(transaction, zkpPrivateKey, nullifierKey) {
  const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
  const storeCommitments = [];
  zkpPrivateKey.forEach((key, j) => {
    const { zkpPublicKey, compressedZkpPublicKey } = ZkpKeys.calculateZkpPublicKey(generalise(key));
    try {
      const [packedErc, unpackedTokenID, ...rest] = decrypt(
        generalise(key),
        generalise(edwardsDecompress(transaction.compressedSecrets[0])),
        generalise(transaction.compressedSecrets.slice(1)),
      );
      const [erc, tokenId] = packSecrets(generalise(packedErc), generalise(unpackedTokenID), 2, 0);
      const plainTexts = generalise([erc, tokenId, ...rest]);
      const commitment = new Commitment({
        compressedZkpPublicKey,
        zkpPublicKey,
        ercAddress: plainTexts[0].bigInt,
        tokenId: plainTexts[1].bigInt,
        value: plainTexts[2].bigInt,
        salt: plainTexts[3].bigInt,
      });
      if (commitment.hash.hex(32) === nonZeroCommitments[0]) {
        storeCommitments.push(storeCommitment(commitment, nullifierKey[j]));
      } else {
        logger.info("This encrypted message isn't for this recipient");
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
