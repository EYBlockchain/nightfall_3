import gen from 'general-number';
import constants from 'common-files/constants/index.mjs';
import utils from 'common-files/utils/crypto/merkle-tree/utils.mjs';

const { generalise } = gen;
const { BN128_GROUP_ORDER } = constants;

const NULL_COMMITMENT = {
  value: 0,
  salt: 0,
};

const computePublicInputs = (tx, rootsOldCommitments, maticAddress, numberNullifiers) => {
  const roots = utils.padArray(generalise(rootsOldCommitments), 0, numberNullifiers);

  const transaction = generalise(tx);

  return {
    value: transaction.value.field(BN128_GROUP_ORDER),
    fee: transaction.fee.field(BN128_GROUP_ORDER),
    transactionType: transaction.transactionType.field(BN128_GROUP_ORDER),
    tokenType: transaction.tokenType.field(BN128_GROUP_ORDER),
    historicRootBlockNumberL2: transaction.historicRootBlockNumberL2.map(h =>
      h.field(BN128_GROUP_ORDER),
    ),
    ercAddress: transaction.ercAddress.field(BN128_GROUP_ORDER),
    tokenId: transaction.tokenId.limbs(32, 8).reverse(),
    recipientAddress: transaction.recipientAddress.field(BN128_GROUP_ORDER),
    commitments: transaction.commitments.map(c => c.field(BN128_GROUP_ORDER)),
    nullifiers: transaction.nullifiers.map(n => n.field(BN128_GROUP_ORDER)),
    compressedSecrets: transaction.compressedSecrets.map(cs => cs.field(BN128_GROUP_ORDER)),
    roots: roots.map(r => r.field(BN128_GROUP_ORDER)),
    feeAddress: generalise(maticAddress).field(BN128_GROUP_ORDER),
  };
};

const computePrivateInputsNullifiers = (
  oldCommitmentPreimage,
  paths,
  orders,
  rootKey,
  numberNullifiers,
) => {
  const paddedOldCommitmentPreimage = utils.padArray(
    oldCommitmentPreimage,
    NULL_COMMITMENT,
    numberNullifiers,
  );
  const paddedPaths = utils.padArray(paths, new Array(32).fill(0), numberNullifiers);
  const paddedOrders = utils.padArray(orders, 0, numberNullifiers);

  return {
    rootKey: rootKey.field(BN128_GROUP_ORDER),
    nullifiersValues: paddedOldCommitmentPreimage.map(commitment =>
      commitment.value.field(BN128_GROUP_ORDER),
    ),
    nullifiersSalts: paddedOldCommitmentPreimage.map(commitment =>
      commitment.salt.field(BN128_GROUP_ORDER),
    ),
    paths: paddedPaths.map(ps => ps.map(p => p.field(BN128_GROUP_ORDER))),
    orders: paddedOrders.map(m => m.field(BN128_GROUP_ORDER)),
  };
};

const computePrivateInputsCommitments = (
  newCommitmentPreimage,
  recipientPublicKeys,
  numberCommitments,
) => {
  const paddedNewCommitmentPreimage = utils.padArray(
    newCommitmentPreimage,
    NULL_COMMITMENT,
    numberCommitments,
  );
  const paddedRecipientPublicKeys = utils.padArray(recipientPublicKeys, [0, 0], numberCommitments);
  return {
    commitmentsValues: paddedNewCommitmentPreimage.map(commitment =>
      commitment.value.field(BN128_GROUP_ORDER),
    ),
    commitmentsSalts: paddedNewCommitmentPreimage.map(commitment =>
      commitment.salt.field(BN128_GROUP_ORDER),
    ),
    recipientPublicKey: paddedRecipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  };
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
  let witness = computePublicInputs(txObject, roots, maticAddress, numberNullifiers);
  const {
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
  if (numberNullifiers > 0) {
    witness = {
      ...witness,
      ...computePrivateInputsNullifiers(
        oldCommitmentPreimage,
        paths,
        orders,
        rootKey,
        numberNullifiers,
      ),
    };
  }

  if (numberCommitments > 0) {
    witness = {
      ...witness,
      ...computePrivateInputsCommitments(
        newCommitmentPreimage,
        recipientPublicKeys,
        numberCommitments,
      ),
    };
  }

  if (ercAddress) {
    const SHIFT = 1461501637330902918203684832716283019655932542976n;
    const [top4Bytes, remainder] = tokenId.limbs(224, 2).map(l => BigInt(l));
    const packedErcAddress = ercAddress.bigInt + top4Bytes * SHIFT;
    witness.packedErcAddressPrivate = generalise(packedErcAddress).field(BN128_GROUP_ORDER);
    witness.idRemainderPrivate = generalise(remainder).field(BN128_GROUP_ORDER);
  }

  if (ephemeralKey) {
    witness.ephemeralKey = ephemeralKey.field(BN128_GROUP_ORDER);
  }

  return witness;
};
