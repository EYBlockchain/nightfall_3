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

const computePublicInputs = (tx, rootsOldCommitments, maticAddress, numberNullifiers) => {
  const roots = padArray(generalise(rootsOldCommitments), 0, numberNullifiers);

  const transaction = generalise(tx);
  return [
    transaction.value.field(BN128_GROUP_ORDER),
    transaction.fee.field(BN128_GROUP_ORDER),
    transaction.transactionType.field(BN128_GROUP_ORDER),
    transaction.tokenType.field(BN128_GROUP_ORDER),
    transaction.historicRootBlockNumberL2.map(h => h.field(BN128_GROUP_ORDER)),
    transaction.tokenId.limbs(32, 8),
    transaction.ercAddress.field(BN128_GROUP_ORDER),
    transaction.recipientAddress.limbs(32, 8),
    transaction.commitments.map(c => c.field(BN128_GROUP_ORDER)),
    transaction.nullifiers.map(n => n.field(BN128_GROUP_ORDER)),
    transaction.compressedSecrets.map(cs => cs.field(BN128_GROUP_ORDER)),
    roots.map(r => r.field(BN128_GROUP_ORDER)),
    generalise(maticAddress).field(BN128_GROUP_ORDER),
  ].flat(Infinity);
};

const computePrivateInputsEncryption = (ephemeralKey, ercAddress, tokenId) => {
  return [
    ephemeralKey.limbs(32, 8),
    ercAddress.field(BN128_GROUP_ORDER),
    tokenId.limbs(32, 8),
  ].flat(Infinity);
};

const computePrivateInputsNullifiers = (
  oldCommitmentPreimage,
  paths,
  orders,
  rootKey,
  numberNullifiers,
) => {
  const paddedOldCommitmentPreimage = padArray(
    oldCommitmentPreimage,
    NULL_COMMITMENT,
    numberNullifiers,
  );
  const paddedPaths = padArray(paths, new Array(32).fill(0), numberNullifiers);
  const paddedOrders = padArray(orders, 0, numberNullifiers);
  const paddedRootKeys = padArray(rootKey, 0, numberNullifiers);

  const privateInputsNullifiers = [
    paddedOldCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
    paddedOldCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    paddedRootKeys.map(r => r.field(BN128_GROUP_ORDER)),
    paddedPaths.map(ps => ps.map(p => p.field(BN128_GROUP_ORDER))),
    paddedOrders.map(m => m.field(BN128_GROUP_ORDER)),
  ].flat(Infinity);
  return privateInputsNullifiers;
};

const computePrivateInputsCommitments = (
  newCommitmentPreimage,
  recipientPublicKeys,
  numberCommitments,
) => {
  const paddedNewCommitmentPreimage = padArray(
    newCommitmentPreimage,
    NULL_COMMITMENT,
    numberCommitments,
  );
  const paddedRecipientPublicKeys = padArray(recipientPublicKeys, [0, 0], numberCommitments);
  return [
    paddedNewCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
    paddedNewCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    paddedRecipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  ].flat(Infinity);
};

const computePrivateInputsDeposit = (salt, recipientPublicKeys) => {
  return [
    salt.field(BN128_GROUP_ORDER),
    recipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  ].flat(Infinity);
};

const computePrivateInputsTokenise = (value, salt, recipientPublicKeys, tokenId, ercAddress) => {
  return [
    value.limbs(8, 31),
    salt.field(BN128_GROUP_ORDER),
    recipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
    tokenId.limbs(32, 8),
    ercAddress.field(BN128_GROUP_ORDER),
  ].flat(Infinity);
};

export const computeTokeniseCircuitInputs = (
  txObject,
  privateData,
  roots = [],
  maticAddress,
  numberNullifiers,
) => {
  const publicWitness = computePublicInputs(txObject, roots, maticAddress, numberNullifiers);
  const { value, salt, recipientPublicKeys, tokenId, ercAddress } = generalise(privateData);
  return [
    ...publicWitness,
    ...computePrivateInputsTokenise(value, salt, recipientPublicKeys, tokenId, ercAddress),
  ];
};

export const computeManufactureCircuitInputs = (
  txObject,
  privateData,
  roots = [],
  maticAddress,
  numberNullifiers,
  numberCommitments,
  tokenIds,
  ercAddresses,
) => {
  const publicWitness = computePublicInputs(txObject, roots, maticAddress, numberNullifiers);
  const {
    oldCommitmentPreimage,
    paths,
    orders,
    rootKey,
    newCommitmentPreimage,
    recipientPublicKeys,
  } = generalise(privateData);

  const witness = [
    ...publicWitness,
    ...computePrivateInputsNullifiers(
      oldCommitmentPreimage,
      paths,
      orders,
      rootKey,
      numberNullifiers,
    ),
    ...computePrivateInputsCommitments(
      newCommitmentPreimage,
      recipientPublicKeys,
      numberCommitments,
    ),
    ...tokenIds.map(tID => tID.limbs(32, 8)),
    ...ercAddresses.map(addr => addr.limbs(32, 8)),
  ];
  return witness;
};

// eslint-disable-next-line import/prefer-default-export
export const computeCircuitInputs = (
  txObject,
  privateData,
  roots = [],
  maticAddress,
  numberNullifiers,
  numberCommitments,
) => {
  const publicWitness = computePublicInputs(txObject, roots, maticAddress, numberNullifiers);
  const {
    salt,
    oldCommitmentPreimage,
    paths,
    orders,
    rootKey,
    newCommitmentPreimage,
    recipientPublicKeys,
    ephemeralKey,
    ercAddress,
    tokenId,
  } = generalise(privateData);

  let witness;
  if (Number(txObject.transactionType) === 0) {
    witness = [...publicWitness, ...computePrivateInputsDeposit(salt, recipientPublicKeys)];
  } else {
    witness = [
      ...publicWitness,
      ...computePrivateInputsNullifiers(
        oldCommitmentPreimage,
        paths,
        orders,
        rootKey,
        numberNullifiers,
      ),
      ...computePrivateInputsCommitments(
        newCommitmentPreimage,
        recipientPublicKeys,
        numberCommitments,
      ),
    ];

    if (Number(txObject.transactionType) === 1) {
      witness.push(...computePrivateInputsEncryption(ephemeralKey, ercAddress, tokenId));
    }
  }

  return witness;
};
