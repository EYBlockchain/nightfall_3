// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import gen from 'general-number';

const { generalise } = gen;
const { BN128_GROUP_ORDER } = global.config;
const NULL_COMMITMENT = {
  value: 0,
  salt: 0,
};
const padArray = (arr: any, padWith: any, n: number) => {
  if (!Array.isArray(arr))
    return generalise([arr, ...Array.from({ length: n - 1 }, () => padWith)]);
  if (arr.length < n) {
    const nullPadding = Array.from({ length: n - arr.length }, () => padWith);
    return generalise(arr.concat(nullPadding));
  }
  return generalise(arr);
};

type PublicInputs = {
  value: string;
  historicRootBlockNumberL2: string;
  transactionType: string;
  tokenType: string;
  tokenId: string[];
  ercAddress: string;
  recipientAddress: string;
  commitments: string[];
  nullifiers: string[];
  compressedSecrets: string[];
};

type CommitmentPreimage = {
  value: string[];
  salt: string;
};

type Point = [string, string];

type Nullifier = {
  oldCommitment: CommitmentPreimage;
  rootKey: string;
  paths: string[];
  orders: string[];
};

type Commitment = {
  newCommitments: CommitmentPreimage;
  recipientPublicKey: Point;
};

type Transfer = {
  ephemeralKey: string[];
  ercAddressTransfer: string[];
  idTransfer: string[];
};

const computePublicInputs = (tx: any, roots: any) => {
  const transaction = generalise(tx);
  const rootsOldCommitments = padArray(generalise(roots), 0, 2);
  const publicInput = [];
  const publicTx: PublicInputs = {
    value: transaction.value.field(BN128_GROUP_ORDER),
    historicRootBlockNumberL2: transaction.historicRootBlockNumberL2.map(h =>
      h.field(BN128_GROUP_ORDER),
    ),
    transactionType: transaction.transactionType.field(BN128_GROUP_ORDER),
    tokenType: transaction.tokenType.field(BN128_GROUP_ORDER),
    tokenId: transaction.tokenId.limbs(32, 8),
    ercAddress: transaction.ercAddress.field(BN128_GROUP_ORDER),
    recipientAddress: transaction.recipientAddress.limbs(32, 8),
    commitments: transaction.commitments.map(c => c.field(BN128_GROUP_ORDER)),
    nullifiers: transaction.nullifiers.map(n => n.field(BN128_GROUP_ORDER)),
    compressedSecrets: transaction.compressedSecrets.map(cs => cs.field(BN128_GROUP_ORDER)),
  };
  publicInput.push(publicTx);
  if (Number(tx.transactionType) !== 0) {
    publicInput.push(rootsOldCommitments.map(r => r.field(BN128_GROUP_ORDER)).flat())
  }

  return publicInput;
};

const computePrivateInputsEncryption = (privateData: any): Transfer => {
  const { ephemeralKey, ercAddress, tokenId } = generalise(privateData);
  return {
    ephemeralKey: ephemeralKey.limbs(32, 8),
    ercAddressTransfer: ercAddress.field(BN128_GROUP_ORDER),
    idTransfer: tokenId.limbs(32, 8),
  };
};

const computePrivateInputsNullifiers = (privateData: any): Nullifier => {
  const { oldCommitmentPreimage, paths, orders, rootKey } = generalise(privateData);
  const paddedOldCommitmentPreimage = padArray(oldCommitmentPreimage, NULL_COMMITMENT, 2);
  const paddedPaths = padArray(paths, new Array(32).fill(0), 2);
  const paddedOrders = padArray(orders, 0, 2);
  const paddedRootKeys = padArray(rootKey, 0, 2);

  return {
    oldCommitment: {
      value: paddedOldCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
      salt: paddedOldCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    },
    rootKey: paddedRootKeys.map(r => r.field(BN128_GROUP_ORDER)),
    paths: paddedPaths.map(ps => ps.map(p => p.field(BN128_GROUP_ORDER))),
    orders: paddedOrders.map(m => m.field(BN128_GROUP_ORDER)),
  };
};

const computePrivateInputsCommitments = (privateData: any, padTo: number) => {
  const { newCommitmentPreimage, recipientPublicKeys } = generalise(privateData);
  const paddedNewCommitmentPreimage = padArray(newCommitmentPreimage, NULL_COMMITMENT, padTo);
  const paddedRecipientPublicKeys = padArray(recipientPublicKeys, [0, 0], padTo);
  return {
    newCommitment: {
      value: paddedNewCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
      salt: paddedNewCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    },
    recipientPublicKey: paddedRecipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  };
};

const computePrivateInputsDeposit = privateData => {
  const { salt, recipientPublicKeys } = generalise(privateData);
  return {
    salt: salt.field(BN128_GROUP_ORDER),
    recipientPublicKey: recipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  };
};

// eslint-disable-next-line import/prefer-default-export
export const computeWitness = (txObject, roots, privateData) => {
  const publicInputs = computePublicInputs(txObject, roots);
  switch (Number(txObject.transactionType)) {
    case 0:
      // Deposit
      return [...publicInputs, computePrivateInputsDeposit(privateData)];
    case 1:
      // Transfer
      return [
        ...publicInputs,
        computePrivateInputsNullifiers(privateData),
        computePrivateInputsCommitments(privateData, 2),
        computePrivateInputsEncryption(privateData),
      ];
    default:
      // Withdraw
      return [
        ...publicInputs,
        computePrivateInputsNullifiers(privateData),
        computePrivateInputsCommitments(privateData, 1),
      ];
  }
};
