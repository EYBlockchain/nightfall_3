/* ignore unused exports */
/* eslint-disable import/first, import/no-unresolved, import/order, import/no-cycle */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

const { MONGO_URL, TRANSACTIONS_COLLECTION, OPTIMIST_DB, PROTOCOL, ZOKRATES_WORKER_HOST } = config;
const { ZERO } = constants;
const { generalise } = gen;

let error = process.env.BAD_TX_SEQUENCE
  ? process.env.BAD_TX_SEQUENCE.split(',')
  : [
      'ValidTransaction',
      'ValidTransaction',
      'ValidTransaction',
      // 'IncorrectTreeRoot',
      // 'IncorrectLeafCount',
      'DuplicateCommitmentTransfer',
      'DuplicateCommitmentDeposit',
      'DuplicateNullifierTransfer',
      'IncorrectProofDeposit',
      'IncorrectProofTransfer',
      'IncorrectPublicInputDepositCommitment',
      'IncorrectPublicInputTransferCommitment',
      'IncorrectPublicInputTransferNullifier',
      'ValidTransaction',
      'DuplicateNullifierWithdraw',
      'IncorrectProofWithdraw',
      'IncorrectPublicInputWithdrawNullifier',
      'IncorrectHistoricRoot', // TODO IncorrectHistoricRootTransfer and IncorrectHistoricRootWithdraw
      'ValidTransaction',
    ];

let resetErrorIdx = false;
let indexOffset = 0;

import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import { getContractInstance } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
import { ws as proposerWebSocket } from './block-assembler.mjs'; // eslint-disable-line import/named

const { BN128_GROUP_ORDER, SHIELD_CONTRACT_NAME } = constants;

// Duplicate Commitment -> { mempool: false, circuit: [deposit,transfer] } -> overwrite with a duplicate spent commitment
// Duplicate Nullifier -> { mempool: false, circuit: [transfer,withdraw] } -> overwrite with a duplicate spent nullifier
// Incorrect Proof -> { mempool: true, circuit: [deposit,transfer,withdraw] } -> overwrite with incorrect proof
// Incorrect public input -> { mempool: true, circuit: [deposit,transfer,withdraw] } -> overwrite with incorrect specific public input (commitment/nullifier)

const duplicateCommitment = async (number, circuitHash) => {
  logger.debug('Creating Transaction with Duplicate Commitment');
  let modifiedTransactions;
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const res = await db.collection(TRANSACTIONS_COLLECTION).find().toArray();
    const spentTransaction = res.filter(t => t.mempool === false);
    const unspentTransaction = res.filter(t => t.mempool && t.circuitHash === circuitHash);
    if (unspentTransaction.length <= 0 || spentTransaction.length <= 0) {
      logger.error('Could not create duplicate commitment');
      return db
        .collection(TRANSACTIONS_COLLECTION)
        .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
        .toArray();
    }
    const { commitments: spentCommitments } = spentTransaction[0];
    logger.debug({
      msg: 'Transaction before modification',
      transaction: unspentTransaction[0],
    });
    logger.debug(`Transaction to be modified for ${circuitHash}`);
    const { commitments: unspentCommitments, ...unspentRes } = unspentTransaction[0];
    const modifiedTransaction = {
      commitments: [spentCommitments[0], unspentCommitments[1], ZERO],
      ...unspentRes,
    };

    const availableTxs = await db
      .collection(TRANSACTIONS_COLLECTION)
      .find({ mempool: true }, { projection: { _id: 0 } })
      .toArray();

    const transactions = availableTxs.filter(
      f => f.transactionHash !== modifiedTransaction.transactionHash,
    );

    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    modifiedTransaction.transactionHash = Transaction.calcHash(modifiedTransaction);
    logger.debug({
      msg: 'Transfer after modification',
      transaction: modifiedTransaction,
    });

    const depositCircuitHash = await axios.get(
      `${PROTOCOL}${ZOKRATES_WORKER_HOST}/get-circuit-hash`,
      {
        params: { circuit: 'deposit' },
      },
    );

    const depositHash = generalise(depositCircuitHash.data.slice(0, 12)).hex(32);

    if (circuitHash === depositHash) {
      // submit modified tx to blockchain
      const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(modifiedTransaction))
        .encodeABI();

      await proposerWebSocket.send(
        JSON.stringify({
          type: 'submit-transaction',
          txDataToSign: rawTransaction,
          transactions: [modifiedTransaction],
        }),
      );

      // while loop basically wait for transaction to be submit and
      // then wait for transactionSumitEventHandler to complete its job and save tx in db
      let isModifiedTransactionInDB = false;
      while (isModifiedTransactionInDB === false) {
        isModifiedTransactionInDB =
          (await getTransactionByTransactionHash(modifiedTransaction.transactionHash)) !== null; // eslint-disable-line no-await-in-loop, no-undef
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    modifiedTransactions = transactions.slice(0, number - 1);
    modifiedTransactions.push(modifiedTransaction);
  } catch (err) {
    logger.debug(err);
  }
  return modifiedTransactions;
};

const duplicateNullifier = async (number, circuitHash) => {
  logger.debug('Creating Transaction with Duplicate Nullifier');
  let modifiedTransactions;
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const res = await db.collection(TRANSACTIONS_COLLECTION).find().toArray();
    const spentTransaction = res.filter(t => t.mempool === false);
    const unspentTransaction = res.filter(t => t.mempool && t.circuitHash === circuitHash);
    if (unspentTransaction.length <= 0 || spentTransaction.length <= 0) {
      logger.error('Could not create duplicate nullifier');
      return db
        .collection(TRANSACTIONS_COLLECTION)
        .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
        .toArray();
    }
    const { nullifiers: spentNullifiers } = spentTransaction[0];
    logger.debug(
      `Transaction before modification ${JSON.stringify(unspentTransaction[0], null, 2)}`,
    );
    logger.debug(`Transaction to be modified for ${circuitHash}`);
    const { nullifiers: unspentNullifiers, ...unspentRes } = unspentTransaction[0];
    const modifiedTransaction = {
      nullifiers: [spentNullifiers[0], unspentNullifiers[1], ZERO, ZERO],
      ...unspentRes,
    };

    const availableTxs = await db
      .collection(TRANSACTIONS_COLLECTION)
      .find({ mempool: true }, { projection: { _id: 0 } })
      .toArray();

    const transactions = availableTxs.filter(
      f => f.transactionHash !== modifiedTransaction.transactionHash,
    );

    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    modifiedTransaction.transactionHash = Transaction.calcHash(modifiedTransaction);
    logger.debug(`Transfer after modification ${JSON.stringify(modifiedTransaction[0], null, 2)}`);

    modifiedTransactions = transactions.slice(0, number - 1);
    modifiedTransactions.push(modifiedTransaction);
  } catch (err) {
    logger.debug(err);
  }
  return modifiedTransactions;
};

const incorrectProof = async (number, circuitHash) => {
  logger.debug('Creating Transaction with Incorrect Proof');
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const [{ proof, ...rest }, ...transactions] = await db
      .collection(TRANSACTIONS_COLLECTION)
      .find(
        { mempool: true, circuitHash },
        { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } },
      )
      .toArray();
    logger.debug(`Transaction before modification ${JSON.stringify({ proof, ...rest }, null, 2)}`);
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
    logger.debug(`Transaction after modification ${JSON.stringify(incorrectProofTx, null, 2)}`);

    const depositCircuitHash = await axios.get(
      `${PROTOCOL}${ZOKRATES_WORKER_HOST}/get-circuit-hash`,
      {
        params: { circuit: 'deposit' },
      },
    );

    const depositHash = generalise(depositCircuitHash.data.slice(0, 12)).hex(32);

    if (circuitHash === depositHash) {
      // submit modified tx to blockchain
      const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(incorrectProofTx))
        .encodeABI();

      await proposerWebSocket.send(
        JSON.stringify({
          type: 'submit-transaction',
          txDataToSign: rawTransaction,
          transactions: [incorrectProofTx],
        }),
      );

      // while loop basically wait for transaction to be submit and
      // then wait for transactionSumitEventHandler to complete its job and save tx in db
      let isModifiedTransactionInDB = false;
      while (isModifiedTransactionInDB === false) {
        isModifiedTransactionInDB =
          (await getTransactionByTransactionHash(incorrectProofTx.transactionHash)) === null; // eslint-disable-line no-await-in-loop, no-undef
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return transactions;
  } catch (err) {
    logger.debug(err);
  }
  return null;
};

const incorrectPublicInput = async (number, circuitHash, publicInputType) => {
  logger.debug('Creating Transaction with Incorrect Public Input');
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const [{ commitments, nullifiers, ...rest }, ...transactions] = await db
      .collection(TRANSACTIONS_COLLECTION)
      .find(
        { mempool: true, circuitHash },
        { limit: number - 1, sort: { fee: -1 }, projection: { _id: 0 } },
      )
      .toArray();

    logger.debug(
      `Transaction before modification ${JSON.stringify(
        { commitments, nullifiers, ...rest },
        null,
        2,
      )}`,
    );

    let incorrectPublicInputTx;
    switch (publicInputType) {
      case 'commitment': {
        commitments[0] = (await randValueLT(BN128_GROUP_ORDER)).hex(32);
        incorrectPublicInputTx = {
          commitments,
          nullifiers,
          ...rest,
        };
        break;
      }
      case 'nullifier': {
        nullifiers[0] = (await randValueLT(BN128_GROUP_ORDER)).hex(32);
        incorrectPublicInputTx = {
          commitments,
          nullifiers,
          ...rest,
        };
        break;
      }
      default: {
        logger.error('Cannot create incorrect public input of type', publicInputType);
        break;
      }
    }
    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    incorrectPublicInputTx.transactionHash = Transaction.calcHash(incorrectPublicInputTx);
    transactions.push(incorrectPublicInputTx);
    logger.debug(
      `Transaction after modification ${JSON.stringify(incorrectPublicInputTx, null, 2)}`,
    );

    const depositCircuitHash = await axios.get(
      `${PROTOCOL}${ZOKRATES_WORKER_HOST}/get-circuit-hash`,
      {
        params: { circuit: 'deposit' },
      },
    );

    const depositHash = generalise(depositCircuitHash.data.slice(0, 12)).hex(32);

    if (circuitHash === depositHash) {
      // submit modified tx to blockchain
      const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(incorrectPublicInputTx))
        .encodeABI();

      await proposerWebSocket.send(
        JSON.stringify({
          type: 'submit-transaction',
          txDataToSign: rawTransaction,
          transactions: [incorrectPublicInputTx],
        }),
      );

      // while loop basically wait for transaction to be submit and
      // then wait for transactionSumitEventHandler to complete its job and save tx in db
      let isModifiedTransactionInDB = false;
      while (isModifiedTransactionInDB === false) {
        isModifiedTransactionInDB =
          (await getTransactionByTransactionHash(incorrectPublicInputTx.transactionHash)) === null; // eslint-disable-line no-await-in-loop, no-undef
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return transactions;
  } catch (err) {
    logger.debug(err);
  }
  return null;
};

const historicRootError = async number => {
  logger.debug('Creating Block with Historic Root Error', number);
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const [incorrectHistoricRoot, ...transactions] = await db
      .collection(TRANSACTIONS_COLLECTION)
      .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
      .toArray();
    incorrectHistoricRoot.historicRootBlockNumberL2 = [
      (Math.floor(Math.random() * 100) + 10).toString(),
      ...incorrectHistoricRoot.historicRootBlockNumberL2.slice(1),
    ];
    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    incorrectHistoricRoot.transactionHash = Transaction.calcHash(incorrectHistoricRoot);
    transactions.push(incorrectHistoricRoot);
    return transactions;
  } catch (err) {
    logger.debug(err);
  }
  return null;
};

export const addTx = txType => {
  error = txType;
  resetErrorIdx = true;
  logger.debug(`Received new Tx types to generate ${error}`);
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

  const depositCircuitHash = await axios.get(
    `${PROTOCOL}${ZOKRATES_WORKER_HOST}/get-circuit-hash`,
    {
      params: { circuit: 'deposit' },
    },
  );

  const depositHash = generalise(depositCircuitHash.data.slice(0, 12)).hex(32);

  const transferCircuitHash = await axios.get(
    `${PROTOCOL}${ZOKRATES_WORKER_HOST}/get-circuit-hash`,
    {
      params: { circuit: 'transfer' },
    },
  );

  const transferHash = generalise(transferCircuitHash.data.slice(0, 12)).hex(32);

  const withdrawCircuitHash = await axios.get(
    `${PROTOCOL}${ZOKRATES_WORKER_HOST}/get-circuit-hash`,
    {
      params: { circuit: 'deposit' },
    },
  );

  const withdrawHash = generalise(withdrawCircuitHash.data.slice(0, 12)).hex(32);

  logger.debug(`Creating a transaction of type ${badTxType}`);
  switch (badTxType) {
    case 'DuplicateCommitmentDeposit':
      return duplicateCommitment(number, depositHash);
    case 'DuplicateCommitmentTransfer':
      return duplicateCommitment(number, transferHash);
    case 'DuplicateNullifierTransfer':
      return duplicateNullifier(number, transferHash);
    case 'DuplicateNullifierWithdraw':
      return duplicateNullifier(number, withdrawHash);
    case 'IncorrectProofDeposit':
      return incorrectProof(number, depositHash);
    case 'IncorrectProofTransfer':
      return incorrectProof(number, transferHash);
    case 'IncorrectProofWithdraw':
      return incorrectProof(number, withdrawHash);
    case 'IncorrectPublicInputDepositCommitment':
      return incorrectPublicInput(number, depositHash, 'commitment');
    case 'IncorrectPublicInputTransferCommitment':
      return incorrectPublicInput(number, transferHash, 'commitment');
    case 'IncorrectPublicInputTransferNullifier':
      return incorrectPublicInput(number, transferHash, 'nullifier');
    case 'IncorrectPublicInputWithdrawNullifier':
      return incorrectPublicInput(number, withdrawHash, 'nullifier');
    case 'IncorrectHistoricRoot':
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
