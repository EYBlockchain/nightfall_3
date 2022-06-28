/* ignore unused exports */
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';

const { MONGO_URL, OPTIMIST_DB, TRANSACTIONS_COLLECTION } = config;

const error = [
  'ValidTransaction',
  'ValidTransaction',
  'ValidTransaction',
  'IncorrectTreeRoot',
  'ValidTransaction',
  'ValidTransaction',
  'ValidTransaction',
  'ValidTransaction',
  'ValidTransaction',
  'ValidTransaction',
  'ValidTransaction',
  'ValidTransaction',
  'IncorrectLeafCount',
  'ValidTransaction',
  'DuplicateTransaction',
  'ValidTransaction',
  'DuplicateNullifier',
  'ValidTransaction',
  'HistoricRootError',
  'ValidTransaction',
  'IncorrectProof',
  'ValidTransaction',
];

const duplicateNullifier = async number => {
  logger.debug('Creating Block with Duplicate Nullifier');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const res = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ transactionType: { $in: ['1', '2', '3'] } })
    .toArray();
  const spentTransfer = res.filter(t => t.mempool === false);
  const unspentTransfer = res.filter(t => t.mempool);
  if (unspentTransfer.length <= 0 || spentTransfer.length <= 0) {
    logger.error('Could not create duplicate nullifier');
    return db
      .collection(TRANSACTIONS_COLLECTION)
      .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
      .toArray();
  }
  const { nullifiers: spentNullifiers } = spentTransfer[0];
  const { nullifiers: unspentNullifiers, ...unspentRes } = unspentTransfer[0];
  const modifiedTransfer = {
    nullifiers: [spentNullifiers[0], unspentNullifiers[1]],
    ...unspentRes,
  };

  const availableTxs = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { projection: { _id: 0 } })
    .toArray();

  const transactions = availableTxs.filter(
    f => f.transactionHash !== modifiedTransfer.transactionHash,
  );
  const modifiedTransactions = transactions.slice(0, number - 1);
  modifiedTransactions.push(modifiedTransfer);

  return modifiedTransactions;
};

const duplicateTransaction = async number => {
  logger.debug('Creating Block with Duplicate Transaction');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const duplicateTx = await db
    .collection(TRANSACTIONS_COLLECTION)
    .findOne({ mempool: false }, { projection: { _id: 0 } });

  const transactions = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } })
    .toArray();

  transactions.push(duplicateTx);
  return transactions;
};

const incorrectProof = async number => {
  logger.debug('Creating Block with Incorrect Proof');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const [{ proof, ...rest }, ...transactions] = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } })
    .toArray();
  const incorrectProofTx = {
    // proof contains G1 and G2 points. Any invalid proof passed should still
    // be valid points
    proof: [
      '0x0109a28a766c5ac7279c284f0006bd8e09dc3147c15a840572fddbefdc05e5f5',
      '0x079a2a996582fa2b1ececa240c1d9f1109aa94698b78aebd9c5aedad3157744b',
      '0x2bb59e1e709bf213d993382f0ebf7335b1eb266d6d3347da012dfa0046c5f80a',
      '0x292e618cd695da698c1f6d8aa76cc27905281d15e4f9c0a1921c1eaf8aceafb2',
      '0x0d267d3cdbc472bf48b605ecdee07ddeb4c221e69b63476aaa628dc450046c4c',
      '0x259e40eab4872719fdb981284db55e3882b43296da7a81bcd8f17268bfde74f9',
      '0x0538c201865077153213157174dc1052f0297aeb9bba931107c7fea5fdec3448',
      '0x2b3bb50ae332c45a8ecb580c3b7b1ee23e44e587c60d829c9fce91d2a48bd12e',
    ],
    ...rest,
  };
  transactions.push(incorrectProofTx);
  return transactions;
};

const historicRootError = async number => {
  logger.debug('Creating Block with Historic Root Error');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const res = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find(
      { mempool: true, transactionType: { $in: ['1', '2', '3'] } },
      { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } },
    )
    .toArray();
  if (res.length === 0) {
    logger.error('Could not create historicRootError error');
    return db
      .collection(TRANSACTIONS_COLLECTION)
      .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
      .toArray();
  }
  const [{ historicRootBlockNumberL2, ...rest }, ...transactions] = res;
  const { transactionType } = rest;
  const incorrectHistoricRoot = {
    historicRootBlockNumberL2:
      Number(transactionType) === 1 || Number(transactionType) === 3
        ? [Math.floor(Math.random() * 100).toString(), '0']
        : Array(2).fill(Math.floor(Math.random() * 100).toString()),
    ...rest,
  };
  transactions.push(incorrectHistoricRoot);
  return transactions;
};

/**
Function to return 'number' transactions, ordered by the highest fee. If there
are fewer than 'number' transactions, all are returned.
*/
// eslint-disable-next-line import/prefer-default-export
export async function getMostProfitableTransactions(number, errorIndex) {
  logger.debug('Creating a transaction of type', error[errorIndex]);
  switch (error[errorIndex]) {
    case 'DuplicateTransaction':
      return duplicateTransaction(number);
    case 'DuplicateNullifier':
      return duplicateNullifier(number);
    case 'IncorrectProof':
      return incorrectProof(number);
    case 'HistoricRootError':
      return historicRootError(number);
    default: {
      const connection = await mongo.connection(MONGO_URL);
      const db = connection.db(OPTIMIST_DB);
      return db
        .collection(TRANSACTIONS_COLLECTION)
        .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
        .toArray();
    }
  }
}
// Duplicate Tx -> { mempool: false }
// Duplicate Nullifier -> { mempool: false, transactionType: 1 } -> overwrite nullifier
// Incorrect Proof -> { mempool: true } -> overwrite proof
// Historic Root Error -> { mempool: true } -> overwrite historic root number
