import gen from 'general-number';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import Nullifier from '../classes/nullifier.mjs';
import {
  clearPending,
  markPending,
  findUsableCommitmentsMutex,
  getSiblingInfo,
  getCommitmentsAvailableByHash,
} from '../services/commitment-storage.mjs';
import Commitment from '../classes/commitment.mjs';
import { ZkpKeys } from '../services/keys.mjs';

const { GN, generalise } = gen;

const { BN128_GROUP_ORDER } = constants;

// eslint-disable-next-line import/prefer-default-export
export const getCommitmentInfo = async txInfo => {
  const {
    totalValueToSend,
    fee = generalise(0),
    recipientZkpPublicKeysArray = [],
    ercAddress,
    feeL2TokenAddress,
    tokenId = generalise(0),
    rootKey,
    providedCommitments = [],
    providedCommitmentsFee = [],
  } = txInfo;

  let { maxNullifiers, maxNonFeeNullifiers = undefined } = txInfo;

  const { zkpPublicKey, compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

  const valuesArray = recipientZkpPublicKeysArray.map(() => totalValueToSend);

  const ercAddressArray = recipientZkpPublicKeysArray.map(() => ercAddress);

  const tokenIdArray = recipientZkpPublicKeysArray.map(() => tokenId);

  // If ercAddress is the same as the feeAddress, we will set the fee as zero and only look for value
  const addedFee = feeL2TokenAddress.hex(32) === ercAddress.hex(32) ? fee.bigInt : 0n;

  logger.debug(`Fee will be added as part of the transaction commitments: ${addedFee > 0n}`);

  let value = totalValueToSend;
  let feeValue = fee.bigInt;

  // If maxNonFeeNullifiers is equal to zero, it means that we are not looking for non fee commitments and so
  // we won't use addedFee logic
  if (maxNonFeeNullifiers === undefined || maxNonFeeNullifiers !== 0) {
    value += addedFee;
    feeValue -= addedFee;
  }

  // Set maxNonFeeNullifiers if undefined. If fee is higher than zero it means we will need at least 1 slot
  // for the fee, so maximum non fee will be maxNullifiers - 1. Otherwise all slots can be used for the transfer
  if (maxNonFeeNullifiers === undefined) {
    maxNonFeeNullifiers = feeValue > 0n ? maxNullifiers - 1 : maxNullifiers;
  }

  const spentCommitments = [];
  try {
    let validatedProvidedCommitments = [];
    let validatedProvidedCommitmentsFee = [];
    let nonFeeCommitmentsProvided = false;
    let feeCommitmentsProvided = false;
    let providedValue = 0n;
    let providedValueFee = 0n;

    // Throw an error if more than the allowed number of max number of nullifiers are provided
    if (providedCommitments.length + providedCommitmentsFee.length > maxNullifiers) {
      throw new Error(`You can not provide more than ${maxNullifiers} commitments to be nullified`);
    }

    // User has the ability to specify the commitments they wanna use. If that's the case, we will need to check that
    // those commitments are valid and fulfill all the requirements. Otherwise, we will use our own algorithm to select
    // the commitments used.
    if (providedCommitments.length > 0) {
      logger.debug({ msg: `using user provided commitments for the value`, providedCommitments });

      const commitmentHashes = providedCommitments.map(c => c.toString());

      // Search for the commitment hashes in the DB. The commitment will be considered valid
      // as long as it is not already nullified
      const rawCommitments = await getCommitmentsAvailableByHash(
        commitmentHashes,
        compressedZkpPublicKey,
      );

      // Filter which of those commitments belong to the ercAddress
      const ercAddressCommitments = rawCommitments.filter(
        c => c.preimage.ercAddress === generalise(ercAddress).hex(32),
      );

      logger.debug({ ercAddressCommitments });

      if (ercAddressCommitments.length < providedCommitments.length) {
        const ercAddressCommitmentsHashes = ercAddressCommitments.map(c => c._id);

        const invalidHashes = providedCommitments.filter(c =>
          ercAddressCommitmentsHashes.includes(c),
        );

        throw new Error(
          `Some of the commitments provided for the value were invalid: ${invalidHashes.join(
            ' , ',
          )}`,
        );
      }

      // Calculate the total value from the ercAddress commitments
      providedValue = ercAddressCommitments
        .map(c => generalise(c.preimage.value).bigInt)
        .reduce((sum, c) => sum + c, 0n);

      if (ercAddressCommitments.length > 0) {
        if (providedValue < totalValueToSend) {
          throw new Error('provided commitments do not cover the value');
        } else {
          nonFeeCommitmentsProvided = true;
          validatedProvidedCommitments = ercAddressCommitments.map(
            ct => new Commitment(ct.preimage),
          );
        }
      }

      // If ercAddress commitments are provided, we force maxNonFeeNullifiers to be zero so that our algorithm
      // does not check for transfer commitments. We cannot rely on value to be zero due to ERC721 tokens
      if (nonFeeCommitmentsProvided) {
        logger.debug({ validatedProvidedCommitments, providedValue });
        maxNonFeeNullifiers = 0;
      }
    }

    if (providedCommitmentsFee.length > 0) {
      logger.debug({ msg: `using user provided commitments for the fee`, providedCommitmentsFee });

      const commitmentHashesFee = providedCommitmentsFee.map(c => c.toString());

      // Search for the commitment hashes in the DB. The commitment will be considered valid
      // as long as it is not already nullified
      const rawCommitmentsFee = await getCommitmentsAvailableByHash(
        commitmentHashesFee,
        compressedZkpPublicKey,
      );

      // Filter which of those commitments belong to the ercAddress
      const ercAddressCommitmentsFee = rawCommitmentsFee.filter(
        c => c.preimage.ercAddress === generalise(feeL2TokenAddress).hex(32),
      );

      logger.debug({ ercAddressCommitmentsFee });

      if (ercAddressCommitmentsFee.length < providedCommitmentsFee.length) {
        const ercAddressCommitmentsHashesFee = ercAddressCommitmentsFee.map(c => c._id);

        const invalidHashesFee = providedCommitmentsFee.filter(
          c => !ercAddressCommitmentsHashesFee.includes(c),
        );

        throw new Error(
          `Some of the commitments provided for the fee were invalid: ${invalidHashesFee.join(
            ' , ',
          )}`,
        );
      }

      // Calculate the total value from the ercAddress commitments
      providedValueFee = ercAddressCommitmentsFee
        .map(c => generalise(c.preimage.value).bigInt)
        .reduce((sum, c) => sum + c, 0n);

      if (ercAddressCommitmentsFee.length > 0) {
        // Check if enough value is provided. Otherwise, throw an error because we assume that
        // if the user provide the commitments he has full control of what is he spending
        if (providedValueFee < fee.bigInt) {
          throw new Error('provided commitments do not cover the fee');
        } else {
          feeCommitmentsProvided = true;
          validatedProvidedCommitmentsFee = ercAddressCommitmentsFee.map(
            ct => new Commitment(ct.preimage),
          );
        }
      }

      if (feeCommitmentsProvided) {
        logger.debug({ validatedProvidedCommitmentsFee, providedValueFee });
        // If ercAddressFee commitments are provided, we force feeValue to be zero so that our algorithm
        // does not check for fee commitments
        feeValue = 0n;
      }
    }

    const validatedCommitments = [
      ...validatedProvidedCommitments,
      ...validatedProvidedCommitmentsFee,
    ];

    // If the user is transferring the same token as the fee, the case in which the user provided
    // enough commitments to cover the value but not the fee is valid.
    // If that is the case, we modify the parameters accordingly.
    if (feeL2TokenAddress.hex(32) === ercAddress.hex(32)) {
      const totalProvidedValue = providedValue + providedValueFee;
      if (totalProvidedValue < value) {
        maxNonFeeNullifiers =
          providedValue >= value ? 0 : maxNonFeeNullifiers - validatedCommitments.length;
        value = providedValue >= value ? 0n : value - providedValue;
      }
    }

    // Update max nullifiers so that validatedCommitments spots are not used
    maxNullifiers -= validatedCommitments.length;

    // Mark the commitments as pendingNullification
    await Promise.all(validatedCommitments.map(c => markPending(c)));

    // Store this commitments inside spentCommitment so that if anything goes wrong we can clear the pending
    // commitments
    spentCommitments.push(...validatedCommitments);

    logger.debug({ maxNullifiers, maxNonFeeNullifiers, feeValue });

    // Use our commitment selection algorithm to select the commitments the user is gonna use for the transfer
    // and the fee
    const commitments = await findUsableCommitmentsMutex(
      compressedZkpPublicKey,
      ercAddress,
      tokenId,
      feeL2TokenAddress,
      value,
      feeValue,
      maxNullifiers,
      maxNonFeeNullifiers,
    );
    logger.debug({ msg: '------------$$$$$$$$$$------', commitments });
    const { oldCommitments, oldCommitmentsFee } = commitments;

    // Add oldcommitments and oldCommitmentsFee to spentCommitments so that if anything goes wrong we can clear the pending
    spentCommitments.push(...oldCommitments);
    spentCommitments.push(...oldCommitmentsFee);

    // Add providedCommitments to oldCommitments array
    oldCommitments.push(...validatedProvidedCommitments);
    oldCommitmentsFee.push(...validatedProvidedCommitmentsFee);

    logger.debug({
      msg: `Commitments used ${addedFee > 0n ? 'including fee' : ''}`,
      oldCommitments,
    });

    if (fee.bigInt - addedFee > 0n) {
      logger.debug({ msg: 'Commitments used for the fee', oldCommitmentsFee });
    }

    // Compute the nullifiers
    const nullifiers = [...oldCommitments, ...oldCommitmentsFee].map(
      commitment => new Nullifier(commitment, nullifierKey),
    );

    // then the new output commitment(s)
    const totalInputCommitmentValue = oldCommitments.reduce(
      (acc, commitment) => acc + commitment.preimage.value.bigInt,
      0n,
    );

    // we may need to return change to the recipient
    const change = totalInputCommitmentValue - (totalValueToSend + addedFee);

    logger.debug({ totalInputCommitmentValue, change });

    // if so, add an output commitment to do that
    if (change !== 0n) {
      valuesArray.push(new GN(change));
      recipientZkpPublicKeysArray.push(zkpPublicKey);
      ercAddressArray.push(ercAddress);
      tokenIdArray.push(tokenId);
    }

    // then the new output commitment(s) fee
    const totalInputCommitmentFeeValue = oldCommitmentsFee.reduce(
      (acc, commitment) => acc + commitment.preimage.value.bigInt,
      0n,
    );

    // we may need to return change to the recipient
    const changeFee = totalInputCommitmentFeeValue - (fee.bigInt - addedFee);

    logger.debug({ totalInputCommitmentFeeValue, changeFee });

    // if so, add an output commitment to do that
    if (changeFee !== 0n) {
      valuesArray.push(new GN(changeFee));
      recipientZkpPublicKeysArray.push(zkpPublicKey);
      ercAddressArray.push(feeL2TokenAddress);
      tokenIdArray.push(generalise(0));
    }

    const salts = await Promise.all(
      recipientZkpPublicKeysArray.map(async () => randValueLT(BN128_GROUP_ORDER)),
    );

    const newCommitments = recipientZkpPublicKeysArray.map(
      (recipientKey, i) =>
        new Commitment({
          ercAddress: ercAddressArray[i],
          tokenId: tokenIdArray[i],
          value: valuesArray[i],
          zkpPublicKey: recipientKey,
          salt: salts[i].bigInt,
        }),
    );

    // Commitment Tree Information
    const commitmentTreeInfo = await Promise.all(
      [...oldCommitments, ...oldCommitmentsFee].map(c => getSiblingInfo(c)),
    );
    logger.debug({ msg: '------------commitmentTreeInfo------', commitmentTreeInfo });
    const localSiblingPaths = commitmentTreeInfo.map(l => {
      const path = l.siblingPath.path.map(p => p.value);
      return generalise([l.root].concat(path.reverse()));
    });
    const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
    const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
    const roots = commitmentTreeInfo.map(l => l.root);

    logger.info({
      msg: 'Constructing transfer transaction with blockNumberL2s and roots',
      blockNumberL2s,
      roots,
    });

    return {
      oldCommitments: [...oldCommitments, ...oldCommitmentsFee],
      nullifiers,
      newCommitments,
      localSiblingPaths,
      leafIndices,
      blockNumberL2s,
      roots,
      salts,
      hasChange: change !== 0n,
      hasChangeFee: changeFee !== 0n,
    };
  } catch (err) {
    logger.error(err);
    await Promise.all(spentCommitments.map(o => clearPending(o)));
    throw err;
  }
};
