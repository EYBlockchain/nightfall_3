import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';

const { MONGO_URL, OPTIMIST_DB, TRANSACTIONS_COLLECTION } = config;

const error = [
  'DuplicateTransaction',
  'DuplicateNullifier',
  'HistoricRootError',
  'IncorrectProof',
  'InvalidTransaction',
];

const duplicateNullifier = async number => {
  logger.debug('Creating Block with Duplicate Nullifier');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const res = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ transactionType: { $gte: 1 } })
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
    unspentRes,
  };

  const availableTxs = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { projection: { _id: 0 } })
    .toArray();

  const transactions = availableTxs.filter(
    f => f.transactionHash !== modifiedTransfer.transactionHash,
  );
  return transactions.slice(0, number - 1).push(modifiedTransfer);
};

const duplicateTransaction = async number => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const duplicateTx = db
    .collection(TRANSACTIONS_COLLECTION)
    .findOne({ mempool: false }, { projection: { _id: 0 } });

  const transactions = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } })
    .toArray();

  return transactions.push(duplicateTx);
};

const incorrectProof = async number => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const [{ proof, ...rest }, ...transactions] = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } })
    .toArray();
  const incorrectProofTx = {
    proof: proof.reverse(),
    rest,
  };
  return transactions.push(incorrectProofTx);
};

const historicRootError = async number => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const [{ historicRootBlockNumberL2, ...rest }, ...transactions] = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } })
    .toArray();
  const incorrectHistoricRoot = {
    historicRootBlockNumberL2: Array(2).fill(Math.floor(Math.random() * 100)),
    rest,
  };
  return transactions.push(incorrectHistoricRoot);
};

/**
Function to return 'number' transactions, ordered by the highest fee. If there
are fewer than 'number' transactions, all are returned.
*/
// eslint-disable-next-line import/prefer-default-export
export async function getMostProfitableTransactions(number) {
  const r = Math.random() * (error.length - 1);
  switch (error[r]) {
    case 'DuplicateTransaction':
      return duplicateTransaction(number);
    case 'DuplicateNullifier':
      return duplicateNullifier(number);
    case 'IncorrectProof':
      return incorrectProof(number);
    case 'historicRootError':
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
