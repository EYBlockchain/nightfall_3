import logger from 'common-files/utils/logger.mjs';
import axios from 'axios';
import Transaction from 'common-files/classes/transaction.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import config from 'config';
import getProposersUrl from '../services/peers.mjs';
import { clearPending, markNullified, storeCommitment } from '../services/commitment-storage.mjs';
import { ZkpKeys } from '../services/keys.mjs';

const NEXT_N_PROPOSERS = 3;
const { SHIELD_CONTRACT_NAME } = config;
// eslint-disable-next-line import/prefer-default-export
export const updateCommitments = async (
  offchain,
  optimisticTransaction,
  newCommitments,
  oldCommitments,
  rootKey,
) => {
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);

  try {
    if (offchain) {
      // dig up connection peers
      const peerList = await getProposersUrl(NEXT_N_PROPOSERS);
      logger.debug(`Peer List: ${JSON.stringify(peerList, null, 2)}`);
      await Promise.all(
        Object.keys(peerList).map(async address => {
          logger.debug(
            `offchain transaction - calling ${peerList[address]}/proposer/offchain-transaction`,
          );
          return axios.post(
            `${peerList[address]}/proposer/offchain-transaction`,
            { transaction: optimisticTransaction },
            { timeout: 3600000 },
          );
        }),
      );
      // we only want to store our own commitments so filter those that don't
      // have our public key
      newCommitments
        .filter(
          commitment =>
            commitment.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32),
        )
        .forEach(commitment => storeCommitment(commitment, nullifierKey)); // TODO insertMany
      // mark the old commitments as nullified
      await Promise.all(
        oldCommitments.map(commitment => markNullified(commitment, optimisticTransaction)),
      );
      return {
        transaction: optimisticTransaction,
      };
    }
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticTransaction))
      .encodeABI();
    // store the commitment on successful computation of the transaction
    newCommitments
      .filter(
        commitment => commitment.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32),
      )
      .forEach(commitment => storeCommitment(commitment, nullifierKey)); // TODO insertMany
    // mark the old commitments as nullified
    await Promise.all(
      oldCommitments.map(commitment => markNullified(commitment, optimisticTransaction)),
    );
    return {
      rawTransaction,
      transaction: optimisticTransaction,
    };
  } catch (err) {
    await Promise.all(oldCommitments.map(commitment => clearPending(commitment)));
    throw new Error(err); // let the caller handle the error
  }
};
