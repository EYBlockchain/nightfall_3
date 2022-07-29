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

const computeWitnessPublic = (tx, rootsNullifiers, rootsNullifiersFee, maticAddress) => {
  const transaction = generalise(tx);
  const roots = padArray(generalise(rootsNullifiers), 0, 2);
  const rootsFee = padArray(generalise(rootsNullifiersFee), 0, 2);
  const publicWitness = [
    transaction.value.field(BN128_GROUP_ORDER),
    transaction.fee.field(BN128_GROUP_ORDER),
    transaction.historicRootBlockNumberL2.map(h => h.field(BN128_GROUP_ORDER)),
    transaction.historicRootBlockNumberL2Fee.map(h => h.field(BN128_GROUP_ORDER)),
    transaction.transactionType.field(BN128_GROUP_ORDER),
    transaction.tokenType.field(BN128_GROUP_ORDER),
    transaction.tokenId.limbs(32, 8),
    transaction.ercAddress.field(BN128_GROUP_ORDER),
    transaction.recipientAddress.limbs(32, 8),
    transaction.commitments.map(c => c.field(BN128_GROUP_ORDER)),
    transaction.nullifiers.map(n => n.field(BN128_GROUP_ORDER)),
    transaction.commitmentFee.map(c => c.field(BN128_GROUP_ORDER)),
    transaction.nullifiersFee.map(n => n.field(BN128_GROUP_ORDER)),
    transaction.compressedSecrets.map(cs => cs.field(BN128_GROUP_ORDER)),
    roots.map(r => r.field(BN128_GROUP_ORDER)),
    rootsFee.map(r => r.field(BN128_GROUP_ORDER)),
    maticAddress.field(BN128_GROUP_ORDER),
  ].flat(Infinity);
  return publicWitness;
};

const computeWitnessEncryption = (ephemeralKey, ercAddress, tokenId) => {
  return [
    ephemeralKey.limbs(32, 8),
    ercAddress.field(BN128_GROUP_ORDER),
    tokenId.limbs(32, 8),
  ].flat(Infinity);
};

const computeWitnessNullifiers = (oldCommitmentPreimage, paths, orders, rootKey) => {
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

const computeWitnessCommitments = (newCommitmentPreimage, recipientPublicKeys) => {
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

const computeWitnessPrivateDeposit = (salt, recipientPublicKeys) => {
  return [
    salt.field(BN128_GROUP_ORDER),
    recipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  ].flat(Infinity);
};

// eslint-disable-next-line import/prefer-default-export
export const computeWitness = (txObject, rootsNullifiers, privateData) => {
  const publicWitness = computeWitnessPublic(txObject, rootsNullifiers);
  const {
    salt,
    oldCommitmentPreimage,
    paths,
    orders,
    rootKey,
    oldCommitmentPreimageFee,
    pathsFee,
    ordersFee,
    rootKeyFee,
    newCommitmentPreimage,
    recipientPublicKeys,
    newCommitmentPreimageFee,
    recipientPublicKeysFee,
    ephemeralKey,
    ercAddress,
    tokenId,
  } = generalise(privateData);

  let witness;
  if (Number(txObject.transactionType) === 0) {
    witness = [...publicWitness, ...computeWitnessPrivateDeposit(salt, recipientPublicKeys)];
  } else {
    witness = [
      ...publicWitness,
      ...computeWitnessNullifiers(oldCommitmentPreimage, paths, orders, rootKey),
      ...computeWitnessCommitments(newCommitmentPreimage, recipientPublicKeys),
      ...computeWitnessNullifiers(oldCommitmentPreimageFee, pathsFee, ordersFee, rootKeyFee),
      ...computeWitnessCommitments(newCommitmentPreimageFee, recipientPublicKeysFee),
    ];

    if (Number(txObject.transactionType) === 1) {
      witness.push(...computeWitnessEncryption(ephemeralKey, ercAddress, tokenId));
    }
  }

  return witness;
};
