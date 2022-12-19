import gen, { GeneralNumber } from 'general-number';
import { randValueLT } from '../../common-files/utils/crypto/crypto-random';
import Commitment from '../classes/commitment';
import Nullifier from '../classes/nullifier';
import {
  clearPending,
  findUsableCommitmentsMutex,
  getCommitmentsByHash,
  getSiblingInfo,
  markPending,
} from '../services/commitment-storage';
import { ZkpKeys } from '../services/keys';

const { generalise } = gen;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { BN128_GROUP_ORDER } = global.nightfallConstants;

type CommitmentsInfo = {
  oldCommitments: any[];
  newCommitments: any[];
  leafIndices: any[];
  localSiblingPaths: any[];
  blockNumberL2s: any[];
  roots: any[];
  nullifiers: any[];
  salts: any[];
  hasChange: boolean;
  hasChangeFee: boolean;
};

type TxInfo = {
  totalValueToSend: bigint;
  fee: bigint;
  recipientZkpPublicKeysArray: any[];
  ercAddress: GeneralNumber;
  maticAddress: GeneralNumber;
  tokenId: GeneralNumber;
  rootKey: any;
  maxNullifiers: number;
  maxNonFeeNullifiers: number | undefined;
  providedCommitments: string[];
  providedCommitmentsFee: string[];
};

const getCommitmentInfo = async (txInfo: TxInfo): Promise<CommitmentsInfo> => {
  const {
    totalValueToSend,
    fee = 0n,
    recipientZkpPublicKeysArray = [],
    ercAddress,
    maticAddress,
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
  const addedFee = maticAddress.hex(32) === ercAddress.hex(32) ? fee : 0n;

  let value = totalValueToSend;
  let feeValue = fee;

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
      const commitmentHashes = providedCommitments.map(c => c.toString());

      // Search for the commitment hashes in the DB. The commitment will be considered valid
      // as long as it is not already nullified
      const rawCommitments = await getCommitmentsByHash(commitmentHashes, compressedZkpPublicKey);

      // Filter which of those commitments belong to the ercAddress
      const ercAddressCommitments = rawCommitments.filter(
        (c: any) => c.preimage.ercAddress === generalise(ercAddress).hex(32),
      );

      if (ercAddressCommitments.length < providedCommitments.length) {
        throw new Error('Some of the commitments provided for the value were invalid');
      }

      // Calculate the total value from the ercAddress commitments
      providedValue = ercAddressCommitments
        .map((c: any) => generalise(c.preimage.value).bigInt)
        .reduce((sum: bigint, c: bigint) => sum + c, 0n);

      if (ercAddressCommitments.length > 0) {
        if (providedValue < totalValueToSend) {
          throw new Error('provided commitments do not cover the value');
        } else {
          nonFeeCommitmentsProvided = true;
          validatedProvidedCommitments = ercAddressCommitments.map(
            (ct: any) => new Commitment(ct.preimage),
          );
        }
      }

      // If ercAddress commitments are provided, we force maxNonFeeNullifiers to be zero so that our algorithm
      // does not check for transfer commitments. We cannot rely on value to be zero due to ERC721 tokens
      if (nonFeeCommitmentsProvided) {
        maxNonFeeNullifiers = 0;
      }
    }

    if (providedCommitmentsFee.length > 0) {
      const commitmentHashesFee = providedCommitmentsFee.map(c => c.toString());

      // Search for the commitment hashes in the DB. The commitment will be considered valid
      // as long as it is not already nullified
      const rawCommitmentsFee = await getCommitmentsByHash(
        commitmentHashesFee,
        compressedZkpPublicKey,
      );

      // Filter which of those commitments belong to the ercAddress
      const ercAddressCommitmentsFee = rawCommitmentsFee.filter(
        (c: any) => c.preimage.ercAddress === generalise(maticAddress).hex(32),
      );

      if (ercAddressCommitmentsFee.length < providedCommitmentsFee.length) {
        throw new Error('Some of the commitments provided for the fee were invalid');
      }

      // Calculate the total value from the ercAddress commitments
      providedValueFee = ercAddressCommitmentsFee
        .map((c: any) => generalise(c.preimage.value).bigInt)
        .reduce((sum: bigint, c: bigint) => sum + c, 0n);

      if (ercAddressCommitmentsFee.length > 0) {
        // Check if enough value is provided. Otherwise, throw an error because we assume that
        // if the user provide the commitments he has full control of what is he spending
        if (providedValueFee < fee) {
          throw new Error('provided commitments do not cover the fee');
        } else {
          feeCommitmentsProvided = true;
          validatedProvidedCommitmentsFee = ercAddressCommitmentsFee.map(
            (ct: any) => new Commitment(ct.preimage),
          );
        }
      }

      if (feeCommitmentsProvided) {
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
    if (maticAddress.hex(32) === ercAddress.hex(32)) {
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

    // Use our commitment selection algorithm to select the commitments the user is gonna use for the transfer
    // and the fee
    const commitments = await findUsableCommitmentsMutex(
      compressedZkpPublicKey,
      ercAddress,
      tokenId,
      maticAddress,
      value,
      feeValue,
      maxNullifiers,
      maxNonFeeNullifiers,
    );
    const { oldCommitments, oldCommitmentsFee } = commitments;

    // Add oldcommitments and oldCommitmentsFee to spentCommitments so that if anything goes wrong we can clear the pending
    spentCommitments.push(...oldCommitments);
    spentCommitments.push(...oldCommitmentsFee);

    // Add providedCommitments to oldCommitments array
    oldCommitments.push(...validatedProvidedCommitments);
    oldCommitmentsFee.push(...validatedProvidedCommitmentsFee);

    // Compute the nullifiers
    const nullifiers = [...oldCommitments, ...oldCommitmentsFee].map(
      commitment => new Nullifier(commitment, nullifierKey),
    );

    // then the new output commitment(s)
    const totalInputCommitmentValue = oldCommitments.reduce(
      (acc: bigint, commitment: Commitment) => acc + commitment.preimage.value.bigInt,
      0n,
    );

    // we may need to return change to the recipient
    const change = totalInputCommitmentValue - (totalValueToSend + addedFee);

    // if so, add an output commitment to do that
    if (generalise(change).bigInt !== 0n) {
      valuesArray.push(generalise(change).bigInt);
      recipientZkpPublicKeysArray.push(zkpPublicKey);
      ercAddressArray.push(ercAddress);
      tokenIdArray.push(tokenId);
    }

    // then the new output commitment(s) fee
    const totalInputCommitmentFeeValue = oldCommitmentsFee.reduce(
      (acc: bigint, commitment: Commitment) => acc + commitment.preimage.value.bigInt,
      0n,
    );

    // we may need to return change to the recipient
    const changeFee = totalInputCommitmentFeeValue - (fee - addedFee);

    // if so, add an output commitment to do that
    if (generalise(changeFee).bigInt !== 0n) {
      valuesArray.push(generalise(changeFee).bigInt);
      recipientZkpPublicKeysArray.push(zkpPublicKey);
      ercAddressArray.push(maticAddress);
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
          salt: salts[i],
        }),
    );

    // Commitment Tree Information
    const commitmentTreeInfo = await Promise.all(
      [...oldCommitments, ...oldCommitmentsFee].map(c => getSiblingInfo(c)),
    );
    const localSiblingPaths = commitmentTreeInfo.map(l => {
      const path = l.siblingPath.path.map((p: any) => p.value);
      return generalise([l.root].concat(path.reverse()));
    });
    const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
    const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
    const roots = commitmentTreeInfo.map(l => l.root);

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
    console.log('ERR', err);
    await Promise.all(spentCommitments.map((o: any) => clearPending(o)));
    throw err;
  }
};

export default getCommitmentInfo;
