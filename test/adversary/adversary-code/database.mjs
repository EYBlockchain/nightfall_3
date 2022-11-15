/* ignore unused exports */
/* eslint-disable import/first, import/no-unresolved, import/order, import/no-cycle */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

const { MONGO_URL, TRANSACTIONS_COLLECTION, OPTIMIST_DB } = config;
const { generalise } = gen;

import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import { getContractInstance } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
import { ws as proposerWebSocket } from './block-assembler.mjs'; // eslint-disable-line import/named

const { BN128_GROUP_ORDER, SHIELD_CONTRACT_NAME } = constants;

// Duplicate Commitment -> { mempool: false, circuit: [deposit,transfer] } -> overwrite with a duplicate spent commitment
// Duplicate Nullifier -> { mempool: false, circuit: [transfer,withdraw] } -> overwrite with a duplicate spent nullifier
// Incorrect Proof -> { mempool: true, circuit: [deposit,transfer,withdraw] } -> overwrite with incorrect proof
// Incorrect public input -> { mempool: true, circuit: [deposit,transfer,withdraw] } -> overwrite with incorrect specific public input (commitment/nullifier)

const duplicateCommitment = async (circuitHash, isDeposit) => {
  logger.debug(`Creating Transaction with Duplicate Commitment for ${circuitHash}`);
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const res = await db.collection(TRANSACTIONS_COLLECTION).find().toArray();
    const duplicateCommitmentTx = res.find(
      t => !t.mempool && t.commitments.length > 0 && t.circuitHash === circuitHash,
    );
    if (!duplicateCommitmentTx) {
      logger.error('Could not create duplicate commitment');
      return [];
    }

    logger.debug({
      msg: 'Transaction before modification',
      transaction: duplicateCommitmentTx,
    });

    // We want to make sure that the transaction is not challenged for a duplicate nullifier
    duplicateCommitmentTx.nullifiers = [];
    duplicateCommitmentTx.historicRootBlockNumberL2 = [];

    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    duplicateCommitmentTx.transactionHash = Transaction.calcHash(duplicateCommitmentTx);

    delete duplicateCommitmentTx._id;
    delete duplicateCommitmentTx.transactionHashLeafIndex;
    delete duplicateCommitmentTx.transactionHashSiblingPath;
    delete duplicateCommitmentTx.transactionHashesRoot;
    delete duplicateCommitmentTx.timeBlockL2;
    duplicateCommitmentTx.blockNumberL2 = -1;
    duplicateCommitmentTx.mempool = true;

    logger.debug({
      msg: 'Transaction after modification',
      transaction: duplicateCommitmentTx,
    });

    if (isDeposit) {
      // submit modified tx to blockchain
      const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(duplicateCommitmentTx))
        .encodeABI();

      await proposerWebSocket.send(
        JSON.stringify({
          type: 'submit-transaction',
          txDataToSign: rawTransaction,
          transactions: [duplicateCommitmentTx],
        }),
      );

      // while loop basically wait for transaction to be submit and
      // then wait for transactionSumitEventHandler to complete its job and save tx in db
      let isModifiedTransactionInDB = false;
      while (isModifiedTransactionInDB === false) {
        isModifiedTransactionInDB =
          (await getTransactionByTransactionHash(duplicateCommitmentTx.transactionHash)) !== null; // eslint-disable-line no-await-in-loop, no-undef
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return [duplicateCommitmentTx];
  } catch (err) {
    logger.debug(err);
  }
  return [];
};

const duplicateNullifier = async circuitHash => {
  logger.debug(`Creating Transaction with Duplicate Nullifier for ${circuitHash}`);
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const res = await db.collection(TRANSACTIONS_COLLECTION).find().toArray();
    const duplicateNullifierTx = res.find(
      t => !t.mempool && t.nullifiers.length > 0 && t.circuitHash === circuitHash,
    );
    if (!duplicateNullifierTx) {
      logger.error('Could not create duplicate nullifier');
      return [];
    }

    logger.debug({
      msg: 'Transaction before modification',
      transaction: duplicateNullifierTx,
    });

    // We want to make sure that the transaction is not challenged for a duplicate nullifier
    duplicateNullifierTx.commitments = [];

    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    duplicateNullifierTx.transactionHash = Transaction.calcHash(duplicateNullifierTx);

    delete duplicateNullifierTx._id;
    delete duplicateNullifierTx.transactionHashLeafIndex;
    delete duplicateNullifierTx.transactionHashSiblingPath;
    delete duplicateNullifierTx.transactionHashesRoot;
    delete duplicateNullifierTx.timeBlockL2;
    duplicateNullifierTx.blockNumberL2 = -1;
    duplicateNullifierTx.mempool = true;

    logger.debug({
      msg: 'Transaction after modification',
      transaction: duplicateNullifierTx,
    });

    return [duplicateNullifierTx];
  } catch (err) {
    logger.debug(err);
  }
  return [];
};

const incorrectProof = async (circuitHash, isDeposit) => {
  logger.debug(`Creating Transaction with Incorrect Proof for ${circuitHash}`);
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const res = await db.collection(TRANSACTIONS_COLLECTION).find().toArray();
    const incorrectProofTx = res.find(t => !t.mempool && t.circuitHash === circuitHash);
    if (!incorrectProofTx) {
      logger.error('Could not create incorrect proof');
      return [];
    }

    // proof contains G1 and G2 points. Any invalid proof passed should still
    // be valid points
    const invalidProof = [
      '0x0109a28a766c5ac7279c284f0006bd8e09dc3147c15a840572fddbefdc05e5f5',
      '0x079a2a996582fa2b1ececa240c1d9f1109aa94698b78aebd9c5aedad3157744b',
      '0x2bb59e1e709bf213d993382f0ebf7335b1eb266d6d3347da012dfa0046c5f80a',
      '0x292e618cd695da698c1f6d8aa76cc27905281d15e4f9c0a1921c1eaf8aceafb2',
      '0x0d267d3cdbc472bf48b605ecdee07ddeb4c221e69b63476aaa628dc450046c4c',
      '0x259e40eab4872719fdb981284db55e3882b43296da7a81bcd8f17268bfde74f9',
      '0x0538c201865077153213157174dc1052f0297aeb9bba931107c7fea5fdec3448',
      '0x2b3bb50ae332c45a8ecb580c3b7b1ee23e44e587c60d829c9fce91d2a48bd12e',
    ];

    incorrectProofTx.proof = invalidProof;
    incorrectProofTx.nullifiers = [];
    incorrectProofTx.historicRootBlockNumberL2 = [];
    incorrectProofTx.commitments = [];

    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    incorrectProofTx.transactionHash = Transaction.calcHash(incorrectProofTx);

    delete incorrectProofTx._id;
    delete incorrectProofTx.transactionHashLeafIndex;
    delete incorrectProofTx.transactionHashSiblingPath;
    delete incorrectProofTx.transactionHashesRoot;
    delete incorrectProofTx.timeBlockL2;
    incorrectProofTx.blockNumberL2 = -1;
    incorrectProofTx.mempool = true;

    logger.debug({
      msg: 'Transaction after modification',
      transaction: incorrectProofTx,
    });

    if (isDeposit) {
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
          (await getTransactionByTransactionHash(incorrectProofTx.transactionHash)) !== null; // eslint-disable-line no-await-in-loop, no-undef
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return [incorrectProofTx];
  } catch (err) {
    logger.debug(err);
  }
  return [];
};

const incorrectPublicInput = async (circuitHash, publicInputType, isDeposit) => {
  logger.debug('Creating Transaction with Incorrect Public Input');
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const res = await db.collection(TRANSACTIONS_COLLECTION).find().toArray();
    const incorrectPublicInputTx = res.find(t => !t.mempool && t.circuitHash === circuitHash);
    if (!incorrectPublicInputTx) {
      logger.error('Could not create incorrect public input tx');
      return [];
    }

    switch (publicInputType) {
      case 'commitment': {
        incorrectPublicInputTx.commitments = [(await randValueLT(BN128_GROUP_ORDER)).hex(32)];
        incorrectPublicInputTx.nullifiers = [];
        incorrectPublicInputTx.historicRootBlockNumberL2 = [];

        break;
      }
      case 'nullifier': {
        incorrectPublicInputTx.nullifiers = [(await randValueLT(BN128_GROUP_ORDER)).hex(32)];
        incorrectPublicInputTx.commitments = [];
        break;
      }
      default: {
        logger.error('Cannot create incorrect public input of type', publicInputType);
        return [];
      }
    }

    delete incorrectPublicInputTx._id;
    delete incorrectPublicInputTx.transactionHashLeafIndex;
    delete incorrectPublicInputTx.transactionHashSiblingPath;
    delete incorrectPublicInputTx.transactionHashesRoot;
    delete incorrectPublicInputTx.timeBlockL2;
    incorrectPublicInputTx.blockNumberL2 = -1;
    incorrectPublicInputTx.mempool = true;

    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    incorrectPublicInputTx.transactionHash = Transaction.calcHash(incorrectPublicInputTx);

    if (isDeposit) {
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
          (await getTransactionByTransactionHash(incorrectPublicInputTx.transactionHash)) !== null; // eslint-disable-line no-await-in-loop, no-undef
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return [incorrectPublicInputTx];
  } catch (err) {
    logger.debug(err);
  }
  return [];
};

const historicRootError = async () => {
  logger.debug('Creating Block with Historic Root Error');
  try {
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(OPTIMIST_DB);
    const res = await db.collection(TRANSACTIONS_COLLECTION).find().toArray();
    const incorrectHistoricRootTx = res.find(
      t => !t.mempool && t.historicRootBlockNumberL2.length > 0,
    );
    if (!incorrectHistoricRootTx) {
      logger.error('Could not create incorrect historic root tx');
      return [];
    }

    incorrectHistoricRootTx.historicRootBlockNumberL2 = [
      (Math.floor(Math.random() * 100) + 10).toString(),
    ];

    incorrectHistoricRootTx.nullifiers = [(await randValueLT(BN128_GROUP_ORDER)).hex(32)];
    incorrectHistoricRootTx.commitments = [];

    delete incorrectHistoricRootTx._id;
    delete incorrectHistoricRootTx.transactionHashLeafIndex;
    delete incorrectHistoricRootTx.transactionHashSiblingPath;
    delete incorrectHistoricRootTx.transactionHashesRoot;
    delete incorrectHistoricRootTx.timeBlockL2;
    incorrectHistoricRootTx.blockNumberL2 = -1;
    incorrectHistoricRootTx.mempool = true;

    // update transactionHash because proposeBlock in State.sol enforces transactionHashesRoot in Block data to be equal to what it calculates from the transactions
    incorrectHistoricRootTx.transactionHash = Transaction.calcHash(incorrectHistoricRootTx);
    return [incorrectHistoricRootTx];
  } catch (err) {
    logger.debug(err);
  }
  return [];
};

/**
Function to return transactions, ordered by the highest fee. 
*/
// eslint-disable-next-line import/prefer-default-export
export async function getSortedByFeeMempoolTransactions(badTxType) {
  const depositCircuitHash = await axios.get(`http://worker/get-circuit-hash`, {
    params: { circuit: 'deposit' },
  });

  const depositHash = generalise(depositCircuitHash.data.slice(0, 12)).hex(5);

  const transferCircuitHash = await axios.get(`http://worker/get-circuit-hash`, {
    params: { circuit: 'transfer' },
  });

  const transferHash = generalise(transferCircuitHash.data.slice(0, 12)).hex(5);

  const withdrawCircuitHash = await axios.get(`http://worker/get-circuit-hash`, {
    params: { circuit: 'withdraw' },
  });

  const withdrawHash = generalise(withdrawCircuitHash.data.slice(0, 12)).hex(5);

  if (badTxType !== 'ValidTransaction') {
    logger.debug(`Creating a transaction of type ${badTxType}`);
  }

  switch (badTxType) {
    case 'DuplicateCommitmentDeposit':
      return duplicateCommitment(depositHash, true);
    case 'DuplicateCommitmentTransfer':
      return duplicateCommitment(transferHash, false);
    case 'DuplicateNullifierTransfer':
      return duplicateNullifier(transferHash);
    case 'DuplicateNullifierWithdraw':
      return duplicateNullifier(withdrawHash);
    case 'IncorrectProofDeposit':
      return incorrectProof(depositHash, true);
    case 'IncorrectProofTransfer':
      return incorrectProof(transferHash, false);
    case 'IncorrectProofWithdraw':
      return incorrectProof(withdrawHash, false);
    case 'IncorrectPublicInputDepositCommitment':
      return incorrectPublicInput(depositHash, 'commitment', true);
    case 'IncorrectPublicInputTransferCommitment':
      return incorrectPublicInput(transferHash, 'commitment', false);
    case 'IncorrectPublicInputTransferNullifier':
      return incorrectPublicInput(transferHash, 'nullifier', false);
    case 'IncorrectPublicInputWithdrawNullifier':
      return incorrectPublicInput(withdrawHash, 'nullifier', false);
    case 'IncorrectHistoricRoot':
      return historicRootError();
    default: {
      const connection = await mongo.connection(MONGO_URL);
      const db = connection.db(OPTIMIST_DB);
      return db
        .collection(TRANSACTIONS_COLLECTION)
        .find({ mempool: true }, { sort: { fee: -1 }, projection: { _id: 0 } })
        .toArray();
    }
  }
}
