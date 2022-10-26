import gen, { GeneralNumber } from 'general-number';
import utils from '../../common-files/utils/crypto/merkle-tree/utils';

const { generalise } = gen;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { BN128_GROUP_ORDER } = global.nightfallConstants;
const NULL_COMMITMENT = {
  value: 0,
  salt: 0,
};

type PublicInputs = {
  value: string;
  fee: string;
  transactionType: string;
  tokenType: string;
  historicRootBlockNumberL2: string[];
  tokenId: string[];
  ercAddress: string;
  recipientAddress: string;
  commitments: string[];
  nullifiers: string[];
  compressedSecrets: string[];
  roots: string[];
  feeAddress: string;
};

type CommitmentPreimage = {
  value: string[][];
  salt: string[];
};

type Nullifier = {
  rootKey: string;
  oldCommitments: CommitmentPreimage;
  paths: string[][];
  orders: string[];
};

type Commitment = {
  newCommitments: CommitmentPreimage;
  recipientPublicKey: string[][];
};

const computePublicInputs = (
  tx: PublicInputs,
  rootsOldCommitments: string[],
  maticAddress: string,
  numberNullifiers: number,
) => {
  const transaction = generalise(tx);
  const roots = utils.padArray(generalise(rootsOldCommitments), 0, numberNullifiers);
  const publicTx: PublicInputs = {
    value: transaction.value.field(BN128_GROUP_ORDER),
    fee: transaction.fee.field(BN128_GROUP_ORDER),
    transactionType: transaction.transactionType.field(BN128_GROUP_ORDER),
    tokenType: transaction.tokenType.field(BN128_GROUP_ORDER),
    historicRootBlockNumberL2: transaction.historicRootBlockNumberL2.map((h: any) =>
      h.field(BN128_GROUP_ORDER),
    ),
    tokenId: transaction.tokenId.limbs(32, 8),
    ercAddress: transaction.ercAddress.field(BN128_GROUP_ORDER),
    recipientAddress: transaction.recipientAddress.field(BN128_GROUP_ORDER),
    commitments: transaction.commitments.map((c: any) => c.field(BN128_GROUP_ORDER)),
    nullifiers: transaction.nullifiers.map((n: any) => n.field(BN128_GROUP_ORDER)),
    compressedSecrets: transaction.compressedSecrets.map((cs: any) => cs.field(BN128_GROUP_ORDER)),
    roots: roots.map((r: any) => r.field(BN128_GROUP_ORDER)),
    feeAddress: generalise(maticAddress).field(BN128_GROUP_ORDER),
  };

  return publicTx;
};

const computePrivateInputsNullifiers = (
  oldCommitmentPreimage: Record<string, GeneralNumber>[],
  paths: GeneralNumber[][],
  orders: GeneralNumber[],
  rootKey: GeneralNumber,
  numberNullifiers: number,
): Nullifier => {
  const paddedOldCommitmentPreimage: Record<string, GeneralNumber>[] = utils.padArray(
    oldCommitmentPreimage,
    NULL_COMMITMENT,
    numberNullifiers,
  );
  const paddedPaths: GeneralNumber[][] = utils.padArray(paths, new Array(32).fill(0), 4);
  const paddedOrders: GeneralNumber[] = utils.padArray(orders, 0, 4);

  return {
    rootKey: rootKey.field(BN128_GROUP_ORDER),
    oldCommitments: {
      value: paddedOldCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
      salt: paddedOldCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    },
    paths: paddedPaths.map(ps => ps.map(p => p.field(BN128_GROUP_ORDER))),
    orders: paddedOrders.map(m => m.field(BN128_GROUP_ORDER)),
  };
};

const computePrivateInputsCommitments = (
  newCommitmentPreimage: Record<string, GeneralNumber>[],
  recipientPublicKeys: GeneralNumber[][],
  numberCommitments: number,
): Commitment => {
  const paddedNewCommitmentPreimage: Record<string, GeneralNumber>[] = utils.padArray(
    newCommitmentPreimage,
    NULL_COMMITMENT,
    numberCommitments,
  );
  const paddedRecipientPublicKeys: GeneralNumber[][] = utils.padArray(
    recipientPublicKeys,
    [0, 0],
    numberCommitments,
  );
  return {
    newCommitments: {
      value: paddedNewCommitmentPreimage.map(commitment => commitment.value.limbs(8, 31)),
      salt: paddedNewCommitmentPreimage.map(commitment => commitment.salt.field(BN128_GROUP_ORDER)),
    },
    recipientPublicKey: paddedRecipientPublicKeys.map(rcp => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  };
};

const computeCircuitInputs = (
  txObject: PublicInputs,
  privateData: Record<string, any>,
  roots: string[],
  maticAddress: string,
  numberNullifiers: number,
  numberCommitments: number,
): any => {
  let witness: any = computePublicInputs(txObject, roots, maticAddress, numberNullifiers);
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
    const [top4Bytes, remainder] = tokenId.limbs(224, 2).map((l: any) => BigInt(l));
    const packedErcAddress = ercAddress.bigInt + top4Bytes * SHIFT;
    witness.packedErcAddressPrivate = generalise(packedErcAddress).field(BN128_GROUP_ORDER);
    witness.idRemainderPrivate = generalise(remainder).field(BN128_GROUP_ORDER);
  }

  if (ephemeralKey) {
    witness.ephemeralKey = ephemeralKey.field(BN128_GROUP_ORDER);
  }

  return witness;
};

export default computeCircuitInputs;
