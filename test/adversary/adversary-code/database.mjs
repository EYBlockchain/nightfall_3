/* ignore unused exports */
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';

const { MONGO_URL, TRANSACTIONS_COLLECTION, OPTIMIST_DB } = config;

const error = process.env.BAD_TX_SEQUENCE
  ? process.env.BAD_TX_SEQUENCE.split(',')
  : [
      'ValidTransaction',
      'ValidTransaction',
      'ValidTransaction',
      // 'IncorrectTreeRoot',
      // 'ValidTransaction',
      // 'IncorrectLeafCount',
      // 'ValidTransaction',
      'DuplicateCommitment',
      'ValidTransaction',
      'DuplicateNullifier',
      'ValidTransaction',
      // 'IncorrectProof',
      // 'ValidTransaction',
    ];

let resetErrorIdx = false;
let indexOffset = 0;

// eslint-disable-next-line import/first, import/no-unresolved
import { Transaction } from '../classes/index.mjs';

const duplicateCommitment = async number => {
  logger.debug('Creating Block with Duplicate Commitment');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const res = await db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ transactionType: { $in: ['0', '1', '2'] } })
    .toArray();
  const spentTransfer = res.filter(t => t.mempool === false);
  const unspentTransfer = res.filter(t => t.mempool);
  if (unspentTransfer.length <= 0 || spentTransfer.length <= 0) {
    logger.error('Could not create duplicate commitment');
    return db
      .collection(TRANSACTIONS_COLLECTION)
      .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
      .toArray();
  }
  const { commitments: spentCommitments } = spentTransfer[0];
  const { commitments: unspentCommitments, ...unspentRes } = unspentTransfer[0];
  const modifiedTransfer = {
    commitments: [spentCommitments[0], unspentCommitments[1]],
    ...unspentRes,
  };
  // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
  modifiedTransfer.transactionHash = Transaction.calcHash(modifiedTransfer);

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
  // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
  modifiedTransfer.transactionHash = Transaction.calcHash(modifiedTransfer);

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
  // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
  incorrectProofTx.transactionHash = Transaction.calcHash(incorrectProofTx);
  transactions.push(incorrectProofTx);
  return transactions;
};

/**
Function to return 'number' transactions, ordered by the highest fee. If there
are fewer than 'number' transactions, all are returned.
*/
// eslint-disable-next-line import/prefer-default-export
export async function getMostProfitableTransactions(number, errorIndex) {
  if (resetErrorIdx) {
    resetErrorIdx = false;
    indexOffset = errorIndex;
  }
  const badTxType = error[errorIndex - indexOffset];
  logger.debug(`Creating a transaction of type ${badTxType}`);
  switch (badTxType) {
    case 'DuplicateCommitment':
      return duplicateCommitment(number);
    case 'DuplicateNullifier':
      return duplicateNullifier(number);
    case 'IncorrectProof':
      return incorrectProof(number);
    default: {
      logger.debug(`Creating a transaction of type ValidBlock`);
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
