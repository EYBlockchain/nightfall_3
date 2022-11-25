import gen from 'general-number';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import utils from '@polygon-nightfall/common-files/utils/crypto/merkle-tree/utils.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

const { generalise } = gen;
const { BN128_GROUP_ORDER, SHIFT } = constants;

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
    circuitHash: transaction.circuitHash.field(BN128_GROUP_ORDER),
    tokenType: transaction.tokenType.field(BN128_GROUP_ORDER),
    historicRootBlockNumberL2: transaction.historicRootBlockNumberL2.map(h =>
      h.field(BN128_GROUP_ORDER),
    ),
    ercAddress: transaction.ercAddress.field(BN128_GROUP_ORDER),
    tokenId: transaction.tokenId.limbs(32, 8),
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

const packErcAddress = (_ercAddress, _tokenId) => {
  logger.debug('packing erc address');
  const ercAddress = generalise(_ercAddress);
  const tokenId = generalise(_tokenId);
  logger.debug({ ercAddress, tokenId });
  const [top4Bytes, remainder] = tokenId.limbs(224, 2).map(l => BigInt(l));
  const packedErcAddress = ercAddress.bigInt + top4Bytes * SHIFT;
  return [packedErcAddress, remainder];
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
    value,
    inputTokens,
    outputTokens,
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
    const [top4Bytes, remainder] = tokenId.limbs(224, 2).map(l => BigInt(l));
    const packedErcAddress = ercAddress.bigInt + top4Bytes * SHIFT;
    witness.packedErcAddressPrivate = generalise(packedErcAddress).field(BN128_GROUP_ORDER);
    witness.idRemainderPrivate = generalise(remainder).field(BN128_GROUP_ORDER);
  }

  if (ephemeralKey) {
    witness.ephemeralKey = ephemeralKey.field(BN128_GROUP_ORDER);
  }

  if (value) {
    witness.valuePrivate = value.field(BN128_GROUP_ORDER);
  }

  if (inputTokens && outputTokens) {
    witness.inputPackedAddressesPrivate = [];
    witness.inputIdRemaindersPrivate = [];
    witness.outputPackedAddressesPrivate = [];
    witness.outputIdRemaindersPrivate = [];

    logger.debug({ inputTokens, outputTokens });
    for (let i = 0; i < numberNullifiers - 2; i++) {
      if (inputTokens.length > 0) {
        const current = inputTokens.shift();
        const inputErcAddress = current.address;
        const inputTokenId = current.id;
        let [packedErcAddress, remainder] = packErcAddress(inputErcAddress, inputTokenId);
        packedErcAddress = generalise(packedErcAddress).field(BN128_GROUP_ORDER);
        remainder = generalise(remainder).field(BN128_GROUP_ORDER);
        witness.inputPackedAddressesPrivate.push(packedErcAddress);
        witness.inputIdRemaindersPrivate.push(remainder);
      } else {
        witness.inputPackedAddressesPrivate.push('0');
        witness.inputIdRemaindersPrivate.push('0');
      }
    }

    for (let i = 0; i < numberCommitments - 1; i++) {
      if (outputTokens.length > 0) {
        const current = outputTokens.shift();
        const outputErcAddress = current.address;
        const outputTokenId = current.id;
        let [packedErcAddress, remainder] = packErcAddress(outputErcAddress, outputTokenId);
        packedErcAddress = generalise(packedErcAddress).field(BN128_GROUP_ORDER);
        remainder = generalise(remainder).field(BN128_GROUP_ORDER);
        witness.outputPackedAddressesPrivate.push(packedErcAddress);
        witness.outputIdRemaindersPrivate.push(remainder);
      } else {
        witness.outputPackedAddressesPrivate.push('0');
        witness.outputIdRemaindersPrivate.push('0');
      }
    }
  }
  return witness;
};
