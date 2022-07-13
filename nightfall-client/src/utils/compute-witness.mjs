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

const computeWitnessPublic = (tx, rootArray) => {
  const transaction = generalise(tx);
  const publicWitness = [
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
  if (rootArray.length !== 0) {
    const roots = padArray(generalise(rootArray), 0, 2);
    publicWitness.push(roots.map(r => r.field(BN128_GROUP_ORDER)));
  }
  return publicWitness.flat(Infinity);
};

const computeWitnessPrivateTransfer = privateObj => {
  const {
    rootKey,
    oldCommitmentPreimage,
    paths,
    orders,
    newCommitmentPreimage,
    recipientPublicKeys,
    ercAddress,
    tokenId,
    ephemeralKey,
  } = generalise(privateObj);
  const paddedOldCommitmentPreimage = padArray(oldCommitmentPreimage, NULL_COMMITMENT, 2);
  const paddedNewCommitmentPreimage = padArray(newCommitmentPreimage, NULL_COMMITMENT, 2);
  const paddedPaths = padArray(paths, new Array(32).fill(0), 2);
  const paddedOrders = padArray(orders, 0, 2);
  const paddedRootKeys = padArray(rootKey, 0, 2);
  const paddedRecipientPublicKeys = padArray(recipientPublicKeys, [0, 0], 2);
  return [
    paddedOldCommitmentPreimage.map(r => r.value.limbs(8, 31)),
    paddedOldCommitmentPreimage.map(r => r.salt.field(BN128_GROUP_ORDER)),
    paddedRootKeys.map(r => r.field(BN128_GROUP_ORDER)),
    paddedPaths.map(ps => ps.map(p => p.field(BN128_GROUP_ORDER))),
    paddedOrders.map(m => m.field(BN128_GROUP_ORDER)),
    paddedNewCommitmentPreimage.map(r => r.value.limbs(8, 31)),
    paddedNewCommitmentPreimage.map(r => r.salt.field(BN128_GROUP_ORDER)),
    paddedRecipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
    ephemeralKey.limbs(32, 8),
    ercAddress.field(BN128_GROUP_ORDER),
    tokenId.limbs(32, 8),
  ].flat(Infinity);
};

const computeWitnessPrivateDeposit = privateObj => {
  const { salt, recipientPublicKeys } = generalise(privateObj);
  return [
    salt.field(BN128_GROUP_ORDER),
    recipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  ].flat(Infinity);
};

const computeWitnessPrivateWithdraw = privateObj => {
  const { rootKey, oldCommitmentPreimage, paths, orders } = generalise(privateObj);
  const paddedOldCommitmentPreimage = padArray(oldCommitmentPreimage, NULL_COMMITMENT, 2);
  const paddedPaths = padArray(paths, new Array(32).fill(0), 2);
  const paddedOrders = padArray(orders, 0, 2);
  const paddedRootKeys = padArray(rootKey, 0, 2);
  const paddedNewCommitmentPreimage =
    generalise(privateObj.newCommitmentPreimage) || generalise(NULL_COMMITMENT);
  return [
    paddedOldCommitmentPreimage.map(r => r.value.limbs(8, 31)),
    paddedOldCommitmentPreimage.map(r => r.salt.field(BN128_GROUP_ORDER)),
    paddedRootKeys.map(r => r.field(BN128_GROUP_ORDER)),
    paddedPaths.map(ps => ps.map(p => p.field(BN128_GROUP_ORDER))),
    paddedOrders.map(m => m.field(BN128_GROUP_ORDER)),
    paddedNewCommitmentPreimage.value.limbs(8, 31),
    paddedNewCommitmentPreimage.salt.field(BN128_GROUP_ORDER),
  ].flat(Infinity);
};

// eslint-disable-next-line import/prefer-default-export
export const computeWitness = (txObject, rootArray, privateObj) => {
  const publicWitness = computeWitnessPublic(txObject, rootArray);
  switch (Number(txObject.transactionType)) {
    case 0:
      return [...publicWitness, ...computeWitnessPrivateDeposit(privateObj)];
    case 1:
      return [...publicWitness, ...computeWitnessPrivateTransfer(privateObj)];
    default:
      return [...publicWitness, ...computeWitnessPrivateWithdraw(privateObj)];
  }
};
