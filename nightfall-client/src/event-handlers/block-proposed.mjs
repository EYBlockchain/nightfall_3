import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import {
  markNullifiedOnChain,
  markOnChain,
  storeCommitment,
  countCommitments,
  countNullifiers,
} from '../services/commitment-storage.mjs';
import getProposeBlockCalldata from '../services/process-calldata.mjs';
import Secrets from '../classes/secrets.mjs';
import { ivks, nsks } from '../services/keys.mjs';

const { ZERO } = config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  logger.info(`Received Block Proposed event`);
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const { transactions, blockNumberL2 } = await getProposeBlockCalldata(data);

  transactions.forEach(async transaction => {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
    const nonZeroNullifiers = transaction.nullifiers.flat().filter(n => n !== ZERO);
    // if transaction is deposit
    if (transaction.transactionType === '0') {
      // if the commitment from deposit is already stored in database, then this commitment has been created by
      // this client and stored during deposit transaction creation. If so, only update that commitment is on chain
      // If not this commitment need not be stored or updated by other clients
      if ((await countCommitments(transaction.commitments)) > 0) {
        await markOnChain(nonZeroCommitments, blockNumberL2, data.blockNumber);
      }
      // if transaction is single transfer or double transfer
    } else if (transaction.transactionType === '1' || transaction.transactionType === '2') {
      // if the commitment from transfer is already stored in database, then this commitment(s) has(ve) been created by
      // this client and stored during transfer transaction creation. If so, only update that this(ese) commitment(s) is(are)
      // on chain. If not, a decryption of the secrets will be done by the recipient client. If the decryption is successful,
      // then the commitment will be stored in the database and will be marked as on chain. If the decryption is unsuccessful,
      // nothing needs to be stored
      if ((await countCommitments(transaction.commitments)) > 0) {
        await Promise.all([
          markOnChain(nonZeroCommitments, blockNumberL2, data.blockNumber),
          markNullifiedOnChain(nonZeroNullifiers, blockNumberL2, data.blockNumber),
        ]);
      } else {
        // eslint-disable-next-line consistent-return
        ivks.every(async (key, i) => {
          // decompress the secrets first and then we will decrypt the secrets from this
          const decompressedSecrets = Secrets.decompressSecrets(transaction.compressedSecrets);
          try {
            const commitment = Secrets.decryptSecrets(
              decompressedSecrets,
              key,
              transaction.commitments[0],
            );
            if (commitment === {}) logger.info("This encrypted message isn't for this recipient");
            else {
              // store commitment if the new commitment in this transaction is intended for this client
              await storeCommitment(commitment, nsks[i]);
              await markOnChain(nonZeroCommitments, blockNumberL2, data.blockNumber);
              return false; // to exit every() loop once the a key has successfully decrypted the secrets of the transaction
            }
          } catch (err) {
            logger.info(err);
            logger.info("This encrypted message isn't for this recipient");
          }
        });
      }
      // if transaction is withdraw
    } else if (transaction.transactionType === '3') {
      // if the nullifier from withdraw is already stored in database, then this nullifier has been created by
      // this client and stored during withdraw transaction creation. If so, only update that nullifier is on chain
      // If not this nullifier need not be stored or updated by other clients
      if ((await countNullifiers(transaction.nullifiers)) > 0) {
        await markNullifiedOnChain(nonZeroNullifiers, blockNumberL2, data.blockNumber);
      }
    } else logger.error('Transaction type is invalid. Transaction type is', transaction.Type);
  });
}

export default blockProposedEventHandler;
