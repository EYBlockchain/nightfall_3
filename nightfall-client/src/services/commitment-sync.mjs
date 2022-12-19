/* eslint-disable import/no-cycle */
/**
commitmentsync services to decrypt commitments from transaction blockproposed events
or use clientCommitmentSync to decrypt when new zkpPrivateKey is received.
*/

import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { generalise } from 'general-number';
import { edwardsDecompress } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { getAllTransactions } from './database.mjs';
import { countCommitments, storeCommitment } from './commitment-storage.mjs';
import { decrypt, packSecrets } from './kem-dem.mjs';
import { ZkpKeys } from './keys.mjs';
import Commitment from '../classes/commitment.mjs';

const { ZERO } = constants;

/**
decrypt commitments for a transaction given zkpPrivateKeys and nullifierKeys.
*/
export async function decryptCommitment(transaction, zkpPrivateKey, nullifierKey) {
  const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
  const storeCommitments = [];
  zkpPrivateKey.forEach((key, j) => {
    const { zkpPublicKey } = ZkpKeys.calculateZkpPublicKey(generalise(key));
    try {
      const cipherTexts = [
        transaction.ercAddress,
        transaction.recipientAddress, // It contains the tokenID encrypted (which is a field)
        ...transaction.compressedSecrets,
      ];
      const [packedErc, unpackedTokenID, ...rest] = decrypt(
        generalise(key),
        generalise(edwardsDecompress(transaction.tokenId)), // Compressed public key is stored in token ID
        generalise(cipherTexts),
      );
      const [erc, tokenId] = packSecrets(generalise(packedErc), generalise(unpackedTokenID), 2, 0);
      const plainTexts = generalise([erc, tokenId, ...rest]);
      const commitment = new Commitment({
        zkpPublicKey,
        ercAddress: plainTexts[0].bigInt,
        tokenId: plainTexts[1].bigInt,
        value: plainTexts[2].bigInt,
        salt: plainTexts[3].bigInt,
      });
      if (commitment.hash.hex(32) === nonZeroCommitments[0]) {
        logger.info({
          msg: 'Commitment successfully decrypted for this recipient',
          commitment,
          transactionHash: transaction.transactionHash,
        });
        storeCommitments.push(storeCommitment(commitment, nullifierKey[j]));
      }
    } catch (err) {
      // This error will be caught regularly if the commitment isn't for us
      // We dont print anything in order not to pollute the logs
    }
  });

  const commitmentsStored = await Promise.all(storeCommitments);
  if (commitmentsStored.length > 0) {
    return true;
  }
  return false;
}

/**
Called when new zkpPrivateKey(s) are recieved , it fetches all available commitments
from commitments collection and decrypts commitments belonging to the new zkpPrivateKey(s).
*/
export async function clientCommitmentSync(zkpPrivateKey, nullifierKey) {
  const transactions = await getAllTransactions();
  for (let i = 0; i < transactions.length; i++) {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transactions[i].commitments.filter(n => n !== ZERO);
    // In order to check if the transaction is a transfer, we check if the compressed secrets
    // are different than zero. All other transaction types have compressedSecrets = [ZERO,ZERO]
    if (
      (transactions[i].compressedSecrets[0] !== ZERO ||
        transactions[i].compressedSecrets[1] !== ZERO) &&
      countCommitments([nonZeroCommitments[0]]) === 0
    )
      decryptCommitment(transactions[i], zkpPrivateKey, nullifierKey);
  }
}
