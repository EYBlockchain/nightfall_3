import axios from 'axios';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { getContractInstance } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { markNullified, storeCommitment } from '../services/commitment-storage.mjs';

const { STATE_CONTRACT_NAME } = constants;

const NEXT_N_PROPOSERS = 3;

// eslint-disable-next-line import/prefer-default-export
export const submitTransaction = async (
  transaction,
  commitmentsInfo,
  compressedZkpPublicKey,
  nullifierKey,
  offchain,
) => {
  // Store new commitments that are ours.
  logger.debug({ msg: 'storing commitments', commitments: commitmentsInfo.newCommitments });
  const storeNewCommitments = commitmentsInfo.newCommitments
    .filter(c => c.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32))
    .map(c => storeCommitment(c, nullifierKey, transaction.transactionHash));

  logger.debug({ msg: 'nullifying commitments', commitments: commitmentsInfo.oldCommitments });
  const nullifyOldCommitments = commitmentsInfo.oldCommitments.map(c =>
    markNullified(c, transaction),
  );

  await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);

  if (offchain) {
    // dig up connection peers
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const currentProposer = await stateContractInstance.methods.currentProposer().call();
    const peerList = { [currentProposer.thisAddress]: currentProposer.url };
    let nextProposer = await stateContractInstance.methods
      .proposers(currentProposer.nextAddress)
      .call();
    let proposerIdx = 0;
    while (
      currentProposer.thisAddress !== nextProposer.thisAddress &&
      proposerIdx <= NEXT_N_PROPOSERS
    ) {
      peerList[nextProposer.thisAddress] = nextProposer.url;
      // eslint-disable-next-line no-await-in-loop
      nextProposer = await stateContractInstance.methods.proposers(nextProposer.nextAddress).call();
      proposerIdx += 1;
    }

    logger.debug({ msg: 'Peer List', peerList });
    await Promise.all(
      Object.keys(peerList).map(async address => {
        logger.debug(
          `offchain transaction - calling ${peerList[address]}/proposer/offchain-transaction`,
        );
        return axios.post(
          `${peerList[address]}/proposer/offchain-transaction`,
          { transaction },
          { timeout: 3600000 },
        );
      }),
    );
  }
};
