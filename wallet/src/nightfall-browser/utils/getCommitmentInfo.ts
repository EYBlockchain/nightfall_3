import gen, { GeneralNumber } from 'general-number';
import { randValueLT } from '../../common-files/utils/crypto/crypto-random';
import Commitment from '../classes/commitment';
import Nullifier from '../classes/nullifier';
import {
  clearPending,
  findUsableCommitmentsMutex,
  getSiblingInfo,
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
};

type TxInfo = {
  totalValueToSend: bigint;
  fee: bigint;
  recipientZkpPublicKeysArray: any[];
  ercAddress: GeneralNumber;
  maticAddress: GeneralNumber;
  tokenId: GeneralNumber;
  rootKey: any;
  maxNumberNullifiers: number;
  onlyFee: boolean;
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
    maxNumberNullifiers,
    onlyFee = false,
  } = txInfo;
  const { zkpPublicKey, compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

  const valuesArray = recipientZkpPublicKeysArray.map(() => totalValueToSend);

  const ercAddressArray = recipientZkpPublicKeysArray.map(() => ercAddress);

  const tokenIdArray = recipientZkpPublicKeysArray.map(() => tokenId);
  const addedFee = maticAddress.hex(32) === ercAddress.hex(32) ? fee : 0n;

  const value = totalValueToSend + addedFee;
  const feeValue = fee - addedFee;

  const commitments = await findUsableCommitmentsMutex(
    compressedZkpPublicKey,
    ercAddress,
    tokenId,
    maticAddress,
    value,
    feeValue,
    maxNumberNullifiers,
    onlyFee,
  );

  if (!commitments) throw new Error('Not available commitments has been found');

  const { oldCommitments, oldCommitmentsFee } = commitments;

  const spentCommitments = [...oldCommitments, ...oldCommitmentsFee];

  try {
    // Compute the nullifiers
    const nullifiers = spentCommitments.map(commitment => new Nullifier(commitment, nullifierKey));

    // then the new output commitment(s)
    const totalInputCommitmentValue = oldCommitments.reduce(
      (acc: bigint, commitment: Commitment) => acc + commitment.preimage.value.bigInt,
      0n,
    );

    // we may need to return change to the recipient
    const change = totalInputCommitmentValue - value;

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
    const changeFee = totalInputCommitmentFeeValue - feeValue;

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

    // Generate new commitments, already truncated to u32[7]
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
    const commitmentTreeInfo = await Promise.all(spentCommitments.map(c => getSiblingInfo(c)));
    const localSiblingPaths = commitmentTreeInfo.map(l => {
      const path = l.siblingPath.path.map((p: any) => p.value);
      return generalise([l.root].concat(path.reverse()));
    });
    const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
    const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
    const roots = commitmentTreeInfo.map(l => l.root);

    return {
      oldCommitments: spentCommitments,
      nullifiers,
      newCommitments,
      localSiblingPaths,
      leafIndices,
      blockNumberL2s,
      roots,
      salts,
    };
  } catch (err) {
    await Promise.all(oldCommitments.map((o: any) => clearPending(o)));
    throw new Error('Failed getting commitment info');
  }
};

export default getCommitmentInfo;
