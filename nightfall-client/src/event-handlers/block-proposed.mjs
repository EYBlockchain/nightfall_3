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

const { ZERO } = config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, keys = [ZERO, ZERO]) {
  logger.info(`Received Block Proposed event`);
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const ivk = keys[0];
  const nsk = keys[1];
  const { transactions, nullifiers, blockNumberL2 } = await getProposeBlockCalldata(data);

  if (nullifiers.length)
    logger.debug(
      `Nullifiers appeared on chain at block number ${blockNumberL2}, ${JSON.stringify(
        nullifiers,
        null,
        2,
      )}`,
    );

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
        await markOnChain(nonZeroCommitments, blockNumberL2);
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
          markOnChain(nonZeroCommitments, blockNumberL2),
          markNullifiedOnChain(nonZeroNullifiers, blockNumberL2),
        ]);
      } else {
        // decompress the secrets first and then we will decrypt the secrets from this
        const decompressedSecrets = Secrets.decompressSecrets(transaction.compressedSecrets);
        try {
          const commitment = Secrets.decryptSecrets(
            decompressedSecrets,
            ivk,
            transaction.commitments[0],
          );
          if (commitment === {}) logger.error("This encrypted message isn't for this recipient");
          else {
            // store commitment if the new commitment in this transaction is intended for this client
            await storeCommitment(commitment, nsk);
            await markOnChain(nonZeroCommitments, blockNumberL2);
          }
        } catch (err) {
          logger.error(err);
          logger.error("This encrypted message isn't for this recipient");
        }
      }
      // if transaction is withdraw
    } else if (transaction.transactionType === '3') {
      // if the nullifier from withdraw is already stored in database, then this nullifier has been created by
      // this client and stored during withdraw transaction creation. If so, only update that nullifier is on chain
      // If not this nullifier need not be stored or updated by other clients
      if ((await countNullifiers(transaction.nullifiers)) > 0) {
        await markNullifiedOnChain(nonZeroNullifiers, blockNumberL2);
      }
    } else logger.error('Transaction type is invalid. Transaction type is', transaction.Type);
  });
}

export default blockProposedEventHandler;
