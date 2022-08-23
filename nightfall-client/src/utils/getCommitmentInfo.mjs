import gen from 'general-number';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import Nullifier from '../classes/nullifier.mjs';
import {
  clearPending,
  findUsableCommitmentsMutex,
  getSiblingInfo,
} from '../services/commitment-storage.mjs';
import Commitment from '../classes/commitment.mjs';
import { ZkpKeys } from '../services/keys.mjs';

const { GN, generalise } = gen;

const { BN128_GROUP_ORDER } = config;

// eslint-disable-next-line import/prefer-default-export
export const getCommitmentInfo = async txInfo => {
  const {
    transferValue,
    addedFee = 0n,
    recipientZkpPublicKeysArray = [],
    ercAddress,
    tokenId = generalise(0),
    rootKey,
  } = txInfo;
  const { zkpPublicKey, compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

  let feeIncluded = false;

  const valuesArray = recipientZkpPublicKeysArray.map(() => transferValue);

  let oldCommitments = await findUsableCommitmentsMutex(
    compressedZkpPublicKey,
    ercAddress,
    tokenId,
    generalise(transferValue + addedFee),
  );
  if (oldCommitments) {
    if (addedFee > 0n) feeIncluded = true;
    logger.debug(
      `Found commitments ${addedFee > 0 ? 'including fee' : ''} ${JSON.stringify(
        oldCommitments,
        null,
        2,
      )}`,
    );
  } else if (addedFee > 0n) {
    // If addedFee is higher than zero it is possible that the user had needed more than two commitments to perform the transaction + fee
    oldCommitments = await findUsableCommitmentsMutex(
      compressedZkpPublicKey,
      ercAddress,
      tokenId,
      generalise(transferValue),
    );
    if (oldCommitments) {
      logger.debug(`Found commitments ${JSON.stringify(oldCommitments, null, 2)}`);
    } else {
      throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
    }
  } else {
    throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  }
  // Having found either 1 or 2 commitments, which are suitable inputs to the
  // proof, the next step is to compute their nullifiers;
  const nullifiers = oldCommitments.map(commitment => new Nullifier(commitment, nullifierKey));
  // then the new output commitment(s)
  const totalInputCommitmentFeeValue = oldCommitments.reduce(
    (acc, commitment) => acc + commitment.preimage.value.bigInt,
    0n,
  );

  // time for a quick sanity check.  We expect the number of old commitments and nullifiers to be equal.
  if (nullifiers.length !== oldCommitments.length) {
    logger.error(
      `number of old commitments: ${oldCommitments.length}, number of nullifiers: ${nullifiers.length}`,
    );
    await Promise.all(oldCommitments.map(o => clearPending(o)));
    throw new Error('Number of nullifiers and old commitments are mismatched');
  }

  // we may need to return change to the recipient
  const change = totalInputCommitmentFeeValue - transferValue - addedFee;

  // if so, add an output commitment to do that
  if (change !== 0n) {
    valuesArray.push(new GN(change));
    recipientZkpPublicKeysArray.push(zkpPublicKey);
  }

  try {
    const salts = await Promise.all(valuesArray.map(async () => randValueLT(BN128_GROUP_ORDER)));

    // Generate new commitments, already truncated to u32[7]
    const newCommitments = valuesArray.map(
      (value, i) =>
        new Commitment({
          ercAddress,
          tokenId,
          value,
          zkpPublicKey: recipientZkpPublicKeysArray[i],
          salt: salts[i].bigInt,
        }),
    );

    // Commitment Tree Information
    const commitmentTreeInfo = await Promise.all(oldCommitments.map(c => getSiblingInfo(c)));
    const localSiblingPaths = commitmentTreeInfo.map(l => {
      const path = l.siblingPath.path.map(p => p.value);
      return generalise([l.root].concat(path.reverse()));
    });
    const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
    const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
    const roots = commitmentTreeInfo.map(l => l.root);
    logger.info(
      `Constructing transfer transaction with blockNumberL2s ${blockNumberL2s} and roots ${roots}`,
    );

    return {
      oldCommitments,
      nullifiers,
      newCommitments,
      localSiblingPaths,
      leafIndices,
      blockNumberL2s,
      roots,
      salts,
      feeIncluded,
    };
  } catch (err) {
    logger.error('Err', err);
    await Promise.all(oldCommitments.map(o => clearPending(o)));
    throw new Error('Failed getting commitment info');
  }
};
