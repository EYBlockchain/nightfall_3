import config from 'config';
import gen from 'general-number';

const { generalise } = gen;
const { BN128_GROUP_ORDER } = config;

const NULL_COMMITMENT = {
  value: 0,
  salt: 0,
};
const padArray = (arr, padWith, n) => {
  if (!Array.isArray(arr))
    return generalise([arr, ...Array.from({ length: n - 1 }, () => padWith)]);
  if (arr.length < n) {
    const nullPadding = Array.from({ length: n - arr.length }, () => padWith);
    return generalise(arr.concat(nullPadding));
  }
  return generalise(arr);
};

const computePublicInputs = (tx, roots) => {
  const transaction = generalise(tx);
  const rootsOldCommitments = padArray(generalise(roots), 0, 2);
  let publicWitness = [
    transaction.value.field(BN128_GROUP_ORDER),
    transaction.historicRootBlockNumberL2.map(h => h.field(BN128_GROUP_ORDER)),
    transaction.transactionType.field(BN128_GROUP_ORDER),
    transaction.tokenType.field(BN128_GROUP_ORDER),
    transaction.tokenId.limbs(32, 8),
    transaction.ercAddress.field(BN128_GROUP_ORDER),
    transaction.recipientAddress.limbs(32, 8),
    transaction.commitments.map(c => c.field(BN128_GROUP_ORDER)),
    transaction.nullifiers.map(n => n.field(BN128_GROUP_ORDER)),
    transaction.compressedSecrets.map(cs => cs.field(BN128_GROUP_ORDER)),
  ];

  if (Number(tx.transactionType) !== 0) {
    publicWitness = [...publicWitness, rootsOldCommitments.map(r => r.field(BN128_GROUP_ORDER))];
  }

  return publicWitness.flat(Infinity);
};

const computePrivateInputsEncryption = privateData => {
  const { ephemeralKey, ercAddress, tokenId } = generalise(privateData);
  return [
    ephemeralKey.limbs(32, 8),
    ercAddress.field(BN128_GROUP_ORDER),
    tokenId.limbs(32, 8),
  ].flat(Infinity);
};

const computePrivateInputsNullifiers = privateData => {
  const { oldCommitmentPreimage, paths, orders, rootKey } = generalise(privateData);
  const paddedOldCommitmentPreimage = padArray(oldCommitmentPreimage, NULL_COMMITMENT, 2);
  const paddedPaths = padArray(paths, new Array(32).fill(0), 2);
  const paddedOrders = padArray(orders, 0, 2);
  const paddedRootKeys = padArray(rootKey, 0, 2);

  return [
    paddedOldCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
    paddedOldCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    paddedRootKeys.map(r => r.field(BN128_GROUP_ORDER)),
    paddedPaths.map(ps => ps.map(p => p.field(BN128_GROUP_ORDER))),
    paddedOrders.map(m => m.field(BN128_GROUP_ORDER)),
  ].flat(Infinity);
};

const computePrivateInputsCommitments = privateData => {
  const { newCommitmentPreimage, recipientPublicKeys } = generalise(privateData);
  const paddedNewCommitmentPreimage = padArray(newCommitmentPreimage, NULL_COMMITMENT, 2);
  const paddedRecipientPublicKeys = padArray(recipientPublicKeys, [0, 0], 2);
  return [
    paddedNewCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
    paddedNewCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    paddedRecipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  ].flat(Infinity);
};

const computePrivateInputsDeposit = privateData => {
  const { salt, recipientPublicKeys } = generalise(privateData);
  return [
    salt.field(BN128_GROUP_ORDER),
    recipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  ].flat(Infinity);
};

// eslint-disable-next-line import/prefer-default-export
export const computeWitness = (txObject, roots, privateData) => {
  const publicInputs = computePublicInputs(txObject, roots);
  switch (Number(txObject.transactionType)) {
    case 0:
      return [...publicInputs, ...computePrivateInputsDeposit(privateData)];
    case 1:
      return [
        ...publicInputs,
        ...computePrivateInputsNullifiers(privateData),
        ...computePrivateInputsCommitments(privateData),
        ...computePrivateInputsEncryption(privateData),
      ];
    default:
      return [
        ...publicInputs,
        ...computePrivateInputsNullifiers(privateData),
        ...computePrivateInputsCommitments(privateData),
      ];
  }
};
