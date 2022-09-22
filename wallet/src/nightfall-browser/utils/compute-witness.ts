import gen, { GeneralNumber } from 'general-number';

const { generalise } = gen;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { BN128_GROUP_ORDER } = global.nightfallConstants;
const NULL_COMMITMENT = {
  value: 0,
  salt: 0,
};
const padArray = <T>(arr: T[], padWith: any, n: number): T[] => {
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

type Transfer = {
  ephemeralKey: string[];
  ercAddressTransfer: string;
  idTransfer: string[];
};

const computePublicInputs = (
  tx: PublicInputs,
  rootsOldCommitments: string[],
  maticAddress: string,
) => {
  const transaction = generalise(tx);
  const publicInput = [];
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
    recipientAddress: transaction.recipientAddress.limbs(32, 8),
    commitments: transaction.commitments.map((c: any) => c.field(BN128_GROUP_ORDER)),
    nullifiers: transaction.nullifiers.map((n: any) => n.field(BN128_GROUP_ORDER)),
    compressedSecrets: transaction.compressedSecrets.map((cs: any) => cs.field(BN128_GROUP_ORDER)),
  };

  publicInput.push(publicTx);
  const roots = padArray(generalise(rootsOldCommitments), 0, 4);
  publicInput.push(roots.map((r: any) => r.field(BN128_GROUP_ORDER)).flat());
  publicInput.push(generalise(maticAddress).field(BN128_GROUP_ORDER));

  return publicInput;
};

const computePrivateInputsEncryption = (
  ephemeralKey: GeneralNumber,
  ercAddress: GeneralNumber,
  tokenId: GeneralNumber,
): Transfer => {
  return {
    ephemeralKey: ephemeralKey.limbs(32, 8),
    ercAddressTransfer: ercAddress.field(BN128_GROUP_ORDER),
    idTransfer: tokenId.limbs(32, 8),
  };
};

const computePrivateInputsNullifiers = (
  oldCommitmentPreimage: Record<string, GeneralNumber>[],
  paths: GeneralNumber[][],
  orders: GeneralNumber[],
  rootKey: GeneralNumber,
): Nullifier => {
  const paddedOldCommitmentPreimage: Record<string, GeneralNumber>[] = padArray(
    oldCommitmentPreimage,
    NULL_COMMITMENT,
    4,
  );
  const paddedPaths: GeneralNumber[][] = padArray(paths, new Array(32).fill(0), 4);
  const paddedOrders: GeneralNumber[] = padArray(orders, 0, 4);

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
  isTransfer: boolean,
): Commitment => {
  const padLength: number = isTransfer ? 3 : 2;
  const paddedNewCommitmentPreimage: Record<string, GeneralNumber>[] = padArray(
    newCommitmentPreimage,
    NULL_COMMITMENT,
    padLength,
  );
  const paddedRecipientPublicKeys: GeneralNumber[][] = padArray(
    recipientPublicKeys,
    [0, 0],
    padLength,
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

const computePrivateInputsDeposit = (
  salt: any,
  recipientPublicKeys: GeneralNumber[][],
): string[] => {
  return [
    salt.field(BN128_GROUP_ORDER),
    recipientPublicKeys.map((rcp: GeneralNumber[]) => [
      rcp[0].field(BN128_GROUP_ORDER),
      rcp[1].field(BN128_GROUP_ORDER),
    ]),
  ].flat(1);
};

const computeCircuitInputs = (
  txObject: PublicInputs,
  privateData: Record<string, any>,
  roots: string[],
  maticAddress: string,
): any => {
  const publicInputs = computePublicInputs(txObject, roots, maticAddress);
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
    witness = [...publicInputs, ...computePrivateInputsDeposit(salt, recipientPublicKeys)];
  } else {
    const isTransfer = Number(txObject.transactionType) === 1;
    witness = [
      ...publicInputs,
      computePrivateInputsNullifiers(oldCommitmentPreimage, paths, orders, rootKey),
      computePrivateInputsCommitments(newCommitmentPreimage, recipientPublicKeys, isTransfer),
    ];

    if (Number(txObject.transactionType) === 1) {
      witness.push(computePrivateInputsEncryption(ephemeralKey, ercAddress, tokenId));
    }
  }
  return witness;
};

export default computeCircuitInputs;
