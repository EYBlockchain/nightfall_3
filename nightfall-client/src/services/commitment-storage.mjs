/* eslint-disable import/no-cycle */
/**
Logic for storing and retrieving commitments from a mongo DB.  Abstracted from
deposit/transfer/withdraw
*/
import config from 'config';
import { Mutex } from 'async-mutex';
import gen from 'general-number';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { Commitment, Nullifier } from '../classes/index.mjs';
// eslint-disable-next-line import/no-cycle
import { isValidWithdrawal } from './valid-withdrawal.mjs';
import {
  getBlockByBlockNumberL2,
  getTransactionByTransactionHash,
  getTransactionHashSiblingInfo,
} from './database.mjs';
import { syncState } from './state-sync.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const { generalise } = gen;
const mutex = new Mutex();

// function to format a commitment for a mongo db and store it
export async function storeCommitment(commitment, nullifierKey) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  // we'll also compute and store the nullifier hash.  This will be useful for
  // spotting if the commitment spend is ever rolled back, which would mean the
  // commitment is once again available to spend
  const nullifierHash = new Nullifier(commitment, nullifierKey).hash.hex(32);
  const preimage = commitment.preimage.all.hex(32);
  preimage.ercAddress = preimage.ercAddress.toLowerCase();
  const data = {
    _id: commitment.hash.hex(32),
    compressedZkpPublicKey: commitment.compressedZkpPublicKey.hex(32),
    preimage,
    isDeposited: commitment.isDeposited || false,
    isOnChain: Number(commitment.isOnChain) || -1,
    isPendingNullification: false, // will not be pending when stored
    isNullified: commitment.isNullified,
    isNullifiedOnChain: Number(commitment.isNullifiedOnChain) || -1,
    nullifier: nullifierHash,
    blockNumber: -1,
  };
  logger.debug(`Storing commitment ${data._id}`);
  // a chain reorg may cause an attempted overwrite. We should allow this, hence
  // the use of replaceOne.
  return db.collection(COMMITMENTS_COLLECTION).insertOne(data);
}
// function to update an existing commitment
export async function updateCommitment(commitment, updates) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { _id: commitment._id };
  const update = { $set: updates };
  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

// function to get count of commitments. Can also be used to check if it exists
export async function countCommitments(commitments) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: { $in: commitments } };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).countDocuments(query);
}

// function to get count of nullifier. Can also be used to check if it exists
export async function countNullifiers(nullifiers) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { nullifier: { $in: nullifiers } };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).countDocuments(query);
}

// function to get count of transaction hashes that belongs to the circuitHash specified
export async function countCircuitTransactions(transactionHashes, circuitHash) {
  const connection = await mongo.connection(MONGO_URL);
  const query = {
    transactionHash: { $in: transactionHashes },
    nullifierCircuitHash: circuitHash,
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).countDocuments(query);
}

// function to get if the transaction hash belongs to a withdraw transaction
export async function isTransactionHashBelongCircuit(transactionHash, circuitHash) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { transactionHash, nullifierCircuitHash: circuitHash };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).countDocuments(query);
}

// function to mark a commitments as on chain for a mongo db
export async function markOnChain(
  commitments,
  blockNumberL2,
  blockNumber,
  transactionHashCommittedL1,
) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: { $in: commitments }, isOnChain: { $eq: -1 } };
  const update = {
    $set: { isOnChain: Number(blockNumberL2), blockNumber, transactionHashCommittedL1 },
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateMany(query, update);
}

// function to mark a commitments as on chain for a mongo db
export async function setSiblingInfo(commitment, siblingPath, leafIndex, root) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: commitment, isOnChain: { $ne: -1 } };
  const update = { $set: { siblingPath, leafIndex, root } };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateMany(query, update);
}

// function to mark a commitment as pending nullication for a mongo db
export async function markPending(commitment) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: commitment.hash.hex(32) };
  const update = { $set: { isPendingNullification: true } };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

// function to mark a commitment as nullified for a mongo db
export async function markNullified(commitment, transaction) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: commitment.hash.hex(32) };
  const update = {
    $set: {
      isPendingNullification: false,
      isNullified: true,
      nullifierCircuitHash: transaction.circuitHash,
      transactionHash: transaction.transactionHash,
    },
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

// function to retrieve commitment with a specified salt
export async function getCommitmentBySalt(salt) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ 'preimage.salt': generalise(salt).hex(32) })
    .toArray();
  return commitments;
}

// function to retrieve commitments by transactionHash of the block in which they were
// committed to
export async function getCommitmentsByTransactionHashL1(transactionHashCommittedL1) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).find({ transactionHashCommittedL1 }).toArray();
}
// function to retrieve commitments by transactionhash of the block in which they were
// nullified
export async function getNullifiedByTransactionHashL1(transactionHashNullifiedL1) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).find({ transactionHashNullifiedL1 }).toArray();
}

export async function getSiblingInfo(commitment) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db
    .collection(COMMITMENTS_COLLECTION)
    .findOne(
      { _id: commitment.hash.hex(32) },
      { projection: { siblingPath: 1, root: 1, order: 1, isOnChain: 1, leafIndex: 1 } },
    );
}

/*
function to clear a commitments nullified status after a rollback.
commitments have two stages of nullification (1) when they are spent by Client
they are marked as isNullified==true to stop them being used in another
transaction but also as isNullifiedOnChain when we know that they've actually
made it into an on-chain L2 block.  This contains the number of the L2 block that
they are in.  We need this if they are ever rolled back because the Rollback
event only broadcasts the number of the block that was successfully challenged.
Without that number, we can't tell which spends to roll back.
Once these properties are cleared, the commitment will automatically become
available for spending again.
*/
export async function clearNullified(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { isNullifiedOnChain: { $gte: Number(blockNumberL2) } };
  const update = {
    $set: { isNullifiedOnChain: -1, blockNumber: -1 },
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateMany(query, update);
}

// as above, but removes isOnChain for deposit commitments
export async function clearOnChain(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  // Clear all onchains
  const query = { isOnChain: { $gte: Number(blockNumberL2) } };
  const update = {
    $set: { isOnChain: -1, blockNumber: -1 },
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateMany(query, update);
}

// function to clear a commitment as pending nullication for a mongo db
export async function clearPending(commitment) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: commitment.hash.hex(32) };
  const update = { $set: { isPendingNullification: false } };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

// function to mark a commitments as nullified on chain for a mongo db
export async function markNullifiedOnChain(
  nullifiers,
  blockNumberL2,
  blockNumber,
  transactionHashNullifiedL1, // the tx in which the nullification happened
) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { nullifier: { $in: nullifiers }, isNullifiedOnChain: { $eq: -1 } };
  const update = {
    $set: { isNullifiedOnChain: Number(blockNumberL2), blockNumber, transactionHashNullifiedL1 },
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateMany(query, update);
}
// function to get the balance of commitments for each ERC address
export async function getWalletBalanceUnfiltered() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isNullified: false, isOnChain: { $gte: 0 } };
  const options = {
    compressedZkpPublicKey: 1,
    'preimage.ercAddress': 1,
    'preimage.tokenId': 1,
    'preimage.value': 1,
    _id: 0,
  };
  const wallet = await db.collection(COMMITMENTS_COLLECTION).find(query, options).toArray();
  // the below is a little complex.  First we extract the ercAddress, tokenId and value
  // from the preimage.  Then we format them nicely. We don't care about the value of the
  // tokenId, other than if it's zero or not (indicating the token type). Then we filter
  // any commitments of zero value and tokenId (meaningless commitments), then we
  // work out the balance contribution of each commitment  - a 721 token has no value field in the
  // commitment but each 721 token counts as a balance of 1. Then finally add up the individual
  // commitment balances to get a balance for each erc address.
  return wallet
    .map(e => ({
      ercAddress: `0x${BigInt(e.preimage.ercAddress).toString(16).padStart(40, '0')}`, // Pad this to actual address length
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      tokenId: !!BigInt(e.preimage.tokenId),
      value: Number(BigInt(e.preimage.value)),
    }))
    .filter(e => e.tokenId || e.value > 0) // there should be no commitments with tokenId and value of ZERO
    .map(e => ({
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      ercAddress: e.ercAddress,
      balance: e.tokenId ? 1 : e.value,
    }))
    .reduce((acc, e) => {
      if (!acc[e.compressedZkpPublicKey]) acc[e.compressedZkpPublicKey] = {};
      if (!acc[e.compressedZkpPublicKey][e.ercAddress])
        acc[e.compressedZkpPublicKey][e.ercAddress] = 0;
      acc[e.compressedZkpPublicKey][e.ercAddress] += e.balance;
      return acc;
    }, {});
}

// function to get the balance of commitments for each ERC address
// TODO does not appear to count ERC721/ERC1155 objects correctly?
export async function getWalletBalance(compressedZkpPublicKey, ercList) {
  let ercAddressList = ercList || [];
  ercAddressList = ercAddressList.map(e => e.toUpperCase());
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isNullified: false, isOnChain: { $gte: 0 } };
  const options = {
    compressedZkpPublicKey: 1,
    'preimage.ercAddress': 1,
    'preimage.tokenId': 1,
    'preimage.value': 1,
    _id: 0,
  };
  const wallet = await db.collection(COMMITMENTS_COLLECTION).find(query, options).toArray();
  // the below is a little complex.  First we extract the ercAddress, tokenId and value
  // from the preimage.  Then we format them nicely. We don't care about the value of the
  // tokenId, other than if it's zero or not (indicating the token type). Then we filter
  // any commitments of zero value and tokenId (meaningless commitments), then we
  // work out the balance contribution of each commitment  - a 721 token has no value field in the
  // commitment but each 721 token counts as a balance of 1. Then finally add up the individual
  // commitment balances to get a balance for each erc address.
  const res = wallet
    .map(e => ({
      ercAddress: `0x${BigInt(e.preimage.ercAddress).toString(16).padStart(40, '0')}`, // Pad this to actual address length
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      tokenId: `0x${BigInt(e.preimage.tokenId).toString(16).padStart(64, '0')}`,
      value: Number(BigInt(e.preimage.value)),
    }))
    .filter(
      e =>
        e.compressedZkpPublicKey === compressedZkpPublicKey &&
        (ercAddressList.length === 0 || ercAddressList.includes(e.ercAddress.toUpperCase())),
    )
    .map(e => {
      return {
        compressedZkpPublicKey: e.compressedZkpPublicKey,
        ercAddress: e.ercAddress,
        balance: e.value,
        tokenId: e.tokenId,
      };
    })
    .reduce((acc, e) => {
      if (!acc[e.ercAddress]) acc[e.ercAddress] = [];

      const list = acc[e.ercAddress];
      const tokenIdIndex = list.findIndex(c => c.tokenId === e.tokenId);
      if (tokenIdIndex >= 0) {
        list[tokenIdIndex].balance += e.balance;
      } else {
        acc[e.ercAddress].push({ balance: e.balance, tokenId: e.tokenId });
      }
      return acc;
    }, {});
  return res;
}

// function to get the balance of pending deposits commitments for each ERC address
export async function getWalletPendingDepositBalance(compressedZkpPublicKey, ercList) {
  let ercAddressList = ercList || [];
  ercAddressList = ercAddressList.map(e => e.toUpperCase());
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isDeposited: true, isNullified: false, isOnChain: { $eq: -1 } };
  const options = {
    compressedZkpPublicKey: 1,
    'preimage.ercAddress': 1,
    'preimage.tokenId': 1,
    'preimage.value': 1,
    _id: 0,
  };
  const wallet = await db.collection(COMMITMENTS_COLLECTION).find(query, options).toArray();
  // the below is a little complex.  First we extract the ercAddress, tokenId and value
  // from the preimage.  Then we format them nicely.
  // Then we filter
  // any commitments of zero value and tokenId (meaningless commitments), then we
  // work out the balance contribution of each commitment  - a 721 token has no value field in the
  // commitment but each 721 token counts as a balance of 1. Then finally add up the individual
  // commitment balances to get a balance for each erc address.
  return wallet
    .map(e => ({
      ercAddress: `0x${BigInt(e.preimage.ercAddress).toString(16).padStart(40, '0')}`, // Pad this to actual address length
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      tokenId: `0x${BigInt(e.preimage.tokenId).toString(16).padStart(64, '0')}`,
      value: Number(BigInt(e.preimage.value)),
    }))
    .filter(
      e =>
        e.value >= 0 &&
        (compressedZkpPublicKey === null || e.compressedZkpPublicKey === compressedZkpPublicKey) &&
        (ercAddressList.length === 0 || ercAddressList.includes(e.ercAddress.toUpperCase())),
    )
    .map(e => ({
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      ercAddress: e.ercAddress,
      balance: e.value,
      tokenId: e.tokenId,
    }))
    .reduce((acc, e) => {
      if (!acc[e.compressedZkpPublicKey]) acc[e.compressedZkpPublicKey] = {};
      if (!acc[e.compressedZkpPublicKey][e.ercAddress])
        acc[e.compressedZkpPublicKey][e.ercAddress] = [0];
      acc[e.compressedZkpPublicKey][e.ercAddress][0] += e.balance;
      const idx = acc[e.compressedZkpPublicKey][e.ercAddress].findIndex(
        el => el.tokenId === e.tokenId,
      );
      if (idx === -1) {
        acc[e.compressedZkpPublicKey][e.ercAddress].push({
          balance: e.balance,
          tokenId: e.tokenId,
        });
      } else {
        acc[e.compressedZkpPublicKey][e.ercAddress][idx].balance += e.balance;
      }
      return acc;
    }, {});
}

// function to get the balance of pending spent commitments from transfer and withdraw for each ERC address
export async function getWalletPendingSpentBalance(compressedZkpPublicKey, ercList) {
  let ercAddressList = ercList || [];
  ercAddressList = ercAddressList.map(e => e.toUpperCase());
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isNullified: true, isNullifiedOnChain: { $eq: -1 } };
  const options = {
    compressedZkpPublicKey: 1,
    'preimage.ercAddress': 1,
    'preimage.tokenId': 1,
    'preimage.value': 1,
    _id: 0,
  };
  const wallet = await db.collection(COMMITMENTS_COLLECTION).find(query, options).toArray();
  // the below is a little complex.  First we extract the ercAddress, tokenId and value
  // from the preimage.  Then we format them nicely. We don't care about the value of the
  // tokenId, other than if it's zero or not (indicating the token type). Then we filter
  // any commitments of zero value and tokenId (meaningless commitments), then we
  // work out the balance contribution of each commitment  - a 721 token has no value field in the
  // commitment but each 721 token counts as a balance of 1. Then finally add up the individual
  // commitment balances to get a balance for each erc address.
  return wallet
    .map(e => ({
      ercAddress: `0x${BigInt(e.preimage.ercAddress).toString(16).padStart(40, '0')}`, // Pad this to actual address length
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      tokenId: `0x${BigInt(e.preimage.tokenId).toString(16).padStart(64, '0')}`,
      value: Number(BigInt(e.preimage.value)),
    }))
    .filter(
      e =>
        e.value >= 0 &&
        (compressedZkpPublicKey === null || e.compressedZkpPublicKey === compressedZkpPublicKey) &&
        (ercAddressList.length === 0 || ercAddressList.includes(e.ercAddress.toUpperCase())),
    )
    .map(e => ({
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      ercAddress: e.ercAddress,
      balance: e.value,
      tokenId: e.tokenId,
    }))
    .reduce((acc, e) => {
      if (!acc[e.compressedZkpPublicKey]) acc[e.compressedZkpPublicKey] = {};
      if (!acc[e.compressedZkpPublicKey][e.ercAddress])
        acc[e.compressedZkpPublicKey][e.ercAddress] = [0];
      acc[e.compressedZkpPublicKey][e.ercAddress][0] += e.balance;
      const idx = acc[e.compressedZkpPublicKey][e.ercAddress].findIndex(
        el => el.tokenId === e.tokenId,
      );
      if (idx === -1) {
        acc[e.compressedZkpPublicKey][e.ercAddress].push({
          balance: e.balance,
          tokenId: e.tokenId,
        });
      } else {
        acc[e.compressedZkpPublicKey][e.ercAddress][idx].balance += e.balance;
      }
      return acc;
    }, {});
}

// function to get the commitments for each ERC address of a zkp public key
export async function getWalletCommitments(compressedZkpPublicKeyList, ercList) {
  let ercAddressList = ercList || [];
  ercAddressList = ercAddressList.map(e => e.toUpperCase());
  let compressedPublicKeyList = compressedZkpPublicKeyList || [];
  compressedPublicKeyList = compressedPublicKeyList.map(e => e.toUpperCase());
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isNullified: false, isOnChain: { $gte: 0 } };
  const options = {
    compressedZkpPublicKey: 1,
    'preimage.ercAddress': 1,
    'preimage.tokenId': 1,
    'preimage.value': 1,
    _id: 0,
  };
  const wallet = await db.collection(COMMITMENTS_COLLECTION).find(query, options).toArray();
  // the below is a little complex.  First we extract the ercAddress, tokenId and value
  // from the preimage.  Then we format them nicely. We don't care about the value of the
  // tokenId, other than if it's zero or not (indicating the token type). Then we filter
  // any commitments of zero value and tokenId (meaningless commitments), then we
  // work out the balance contribution of each commitment  - a 721 token has no value field in the
  // commitment but each 721 token counts as a balance of 1. Then finally add up the individual
  // commitment balances to get a balance for each erc address.
  return wallet
    .map(e => ({
      ercAddress: `0x${BigInt(e.preimage.ercAddress).toString(16).padStart(40, '0')}`,
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      tokenId: `0x${BigInt(e.preimage.tokenId).toString(16).padStart(64, '0')}`,
      value: Number(BigInt(e.preimage.value)),
    }))
    .filter(
      e =>
        (e.tokenId || e.value > 0) && // there should be no commitments with tokenId and value of ZERO
        (compressedPublicKeyList.length === 0 ||
          compressedPublicKeyList.includes(e.compressedZkpPublicKey.toUpperCase())) &&
        (ercAddressList.length === 0 || ercAddressList.includes(e.ercAddress.toUpperCase())),
    )
    .map(e => ({
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      ercAddress: e.ercAddress,
      balance: e.value,
      tokenId: e.tokenId,
    }))
    .reduce((acc, e) => {
      if (!acc[e.compressedZkpPublicKey]) acc[e.compressedZkpPublicKey] = {};
      if (!acc[e.compressedZkpPublicKey][e.ercAddress])
        acc[e.compressedZkpPublicKey][e.ercAddress] = [];
      acc[e.compressedZkpPublicKey][e.ercAddress].push(e);
      return acc;
    }, {});
}

// function to get the withdraw commitments for each ERC address of a zkp public key
export async function getCommitmentsByCircuitHash(circuitHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = {
    isNullified: true,
    nullifierCircuitHash: circuitHash,
    isNullifiedOnChain: { $gte: 0 },
  };
  // Get associated nullifiers of commitments that have been spent on-chain and are used for withdrawals.
  const withdraws = await db.collection(COMMITMENTS_COLLECTION).find(query).toArray();
  // To check validity we need the withdrawal transaction, the block the transaction is in and all other
  // transactions in the block. We need this for on-chain validity checks.
  const blockTxs = await Promise.all(
    withdraws.map(async w => {
      const block = await getBlockByBlockNumberL2(w.isNullifiedOnChain);
      const transactions = await Promise.all(
        block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
      );
      const index = block.transactionHashes.findIndex(t => t === w.transactionHash);
      return {
        block,
        transactions,
        index,
        compressedZkpPublicKey: w.compressedZkpPublicKey,
        ercAddress: `0x${BigInt(w.preimage.ercAddress).toString(16).padStart(40, '0')}`, // Pad this to be a correct address length
        balance: w.preimage.tokenId ? 1 : w.preimage.value,
      };
    }),
  );

  // Run the validity check for each of the potential withdraws we have.
  const withdrawsDetailsValid = await Promise.all(
    blockTxs.map(async wt => {
      const { block, transactions, index } = wt;
      const transaction = transactions[index];
      const { transactionHashSiblingPath, transactionHashesRoot } =
        await getTransactionHashSiblingInfo(transaction.transactionHash);
      const siblingPath = [transactionHashesRoot].concat(
        transactionHashSiblingPath.path.map(p => p.value).reverse(),
      );
      const valid = await isValidWithdrawal({
        block,
        transaction,
        index,
        siblingPath,
      });
      return {
        compressedZkpPublicKey: wt.compressedZkpPublicKey,
        ercAddress: wt.ercAddress,
        balance: wt.balance,
        valid,
      };
    }),
  );

  return withdrawsDetailsValid.reduce((acc, e) => {
    if (!acc[e.compressedZkpPublicKey]) acc[e.compressedZkpPublicKey] = {};
    if (!acc[e.compressedZkpPublicKey][e.ercAddress])
      acc[e.compressedZkpPublicKey][e.ercAddress] = [];
    acc[e.compressedZkpPublicKey][e.ercAddress].push(e);
    return acc;
  }, {});
}

// as above, but removes output commitments
export async function deleteCommitments(commitments) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { _id: { $in: commitments }, isOnChain: { $eq: -1 } };
  return db.collection(COMMITMENTS_COLLECTION).deleteMany(query);
}

export async function getCommitmentsFromBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isOnChain: { $gte: blockNumberL2 } };
  return db.collection(COMMITMENTS_COLLECTION).find(query).toArray();
}

async function verifyEnoughCommitments(
  compressedZkpPublicKey,
  ercAddress,
  tokenId,
  value,
  ercAddressFee,
  fee,
  maxNullifiers,
  maxNonFeeNullifiers,
) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);

  let minFc = 0; // Minimum number of fee commitments required to pay the fee
  let commitmentsFee = []; // Array containing the fee commitments available sorted
  let minC = 0;
  let commitments = [];

  if (maxNonFeeNullifiers !== 0) {
    // Get the commitments from the database
    const commitmentArray = await db
      .collection(COMMITMENTS_COLLECTION)
      .find({
        compressedZkpPublicKey: compressedZkpPublicKey.hex(32),
        'preimage.ercAddress': ercAddress.hex(32),
        'preimage.tokenId': tokenId.hex(32),
        isNullified: false,
        isPendingNullification: false,
      })
      .toArray();

    // If not commitments are found, the transfer/withdrawal cannot be paid, so throw an error
    if (commitmentArray.length === 0)
      throw new Error('no commitment for the actual transfer found');

    // Turn the fee commitments into real commitment object and sort it
    commitments = commitmentArray
      .filter(commitment => Number(commitment.isOnChain) > Number(-1)) // filters for on chain commitments
      .map(ct => new Commitment(ct.preimage))
      .sort((a, b) => Number(a.preimage.value.bigInt - b.preimage.value.bigInt));

    const c = commitments.length; // Store the number of commitments

    // At most, we can use (maxNullifiers - number of fee commitments needed) commitments to pay for the
    // transfer or withdraw. However, it is possible that the user doesn't have enough commitments.
    // Therefore, the maximum number of commitments the user will be able to use is the minimum between
    // maxNullifiers - minFc and the number of commitments (c)

    const minimumFeeCommits = fee.bigInt > 0n ? 1 : 0;
    const maxPossibleCommitments = Math.min(c, maxNullifiers - minimumFeeCommits);

    let j = 1;
    let sumHighestCommitments = 0n;
    // We try to find the minimum number of commitments whose sum is higher than the value sent.
    // Since the array is sorted, we just need to try to sum the highest commitments.
    while (j <= maxPossibleCommitments) {
      sumHighestCommitments += commitments[c - j].preimage.value.bigInt;
      if (sumHighestCommitments >= value.bigInt) {
        minC = j;
        break;
      }
      ++j;
    }

    // If after the loop minC is still zero means that we didn't found any sum of commitments
    // higher or equal than the amount required. Therefore the user can not pay it
    if (minC === 0 || minC > maxNonFeeNullifiers) {
      throw new Error('no commitments found to cover the value');
    }
  }

  // If there is a fee and the ercAddress of the fee doesn't match the ercAddress, get
  // the fee commitments available and check the minimum number of commitments the user
  // would need to pay for the fee
  if (fee.bigInt > 0n) {
    // Get the fee commitments from the database
    const commitmentArrayFee = await db
      .collection(COMMITMENTS_COLLECTION)
      .find({
        compressedZkpPublicKey: compressedZkpPublicKey.hex(32),
        'preimage.ercAddress': ercAddressFee.hex(32),
        'preimage.tokenId': generalise(0).hex(32),
        isNullified: false,
        isPendingNullification: false,
      })
      .toArray();

    // If not commitments are found, the fee cannot be paid, so throw an error
    if (commitmentArrayFee.length === 0) throw new Error('no commitments found');

    // Turn the fee commitments into real commitment object and sort it
    commitmentsFee = commitmentArrayFee
      .filter(commitment => Number(commitment.isOnChain) > Number(-1)) // filters for on chain commitments
      .map(ct => new Commitment(ct.preimage))
      .sort((a, b) => Number(a.preimage.value.bigInt - b.preimage.value.bigInt));

    const fc = commitmentsFee.length; // Store the number of fee commitments

    const maxPossibleCommitmentsFee = Math.min(fc, maxNullifiers - minC);

    let i = 1;
    let sumHighestCommitmentsFee = 0n;
    // We try to find the minimum number of commitments whose sum is higher than the fee.
    // Since the array is sorted, we just need to try to sum the highest commitments.
    while (i <= maxPossibleCommitmentsFee) {
      sumHighestCommitmentsFee += commitmentsFee[fc - i].preimage.value.bigInt;
      if (sumHighestCommitmentsFee >= fee.bigInt) {
        minFc = i;
        break;
      }
      ++i;
    }

    // If after the loop minFc is still zero means that we didn't found any sum of commitments
    // higher or equal than the fee required. Therefore the user can not pay it
    if (minFc === 0) throw new Error('no commitments to cover the fee');
  }

  return { commitmentsFee, minFc, commitments, minC };
}

/**
 * This function finds if there is any pair of commitments
 * whose sum value is equal or higher
 */
function findSubsetTwoCommitments(commitments, value) {
  // Since all commitments has a positive value, if target value is smaller than zero return
  if (value.bigInt <= 0n) return [];

  // We are only interested in subsets of 2 in which all the commitments are
  // smaller than the target value
  const commitmentsFiltered = commitments.filter(s => s.preimage.value.bigInt < value.bigInt);

  // If there isn't any valid subset of 2 in which all values are smaller, return
  if (commitmentsFiltered.length < 2) return [];

  let lhs = 0; // Left pointer
  let rhs = commitmentsFiltered.length - 1; // Right pointer

  let change = Infinity;
  let commitmentsToUse = [];
  while (lhs < rhs) {
    // Calculate the sum of the commitments that we are pointing to
    const twoSumCommitments =
      commitmentsFiltered[lhs].preimage.value.bigInt +
      commitmentsFiltered[rhs].preimage.value.bigInt;

    // If an exact solution is found, return
    if (twoSumCommitments === value.bigInt)
      return [commitmentsFiltered[lhs], commitmentsFiltered[rhs]];

    // Since the array of commitments is sorted by value, depending if the sum is higher or smaller
    // we will move the left pointer (increase) or the right one
    if (twoSumCommitments > value.bigInt) {
      // Work out what the change to the value smallest commit we used is.
      const tempChange = twoSumCommitments - value.bigInt;

      if (tempChange < change) {
        // We have a set of commitments that has a lower negative change in our outputs.
        change = tempChange;
        commitmentsToUse = [commitmentsFiltered[lhs], commitmentsFiltered[rhs]];
      }
      rhs--;
    } else lhs++;
  }

  return commitmentsToUse;
}

function findSubsetNCommitments(N, commitments, value) {
  if (N === 1) {
    for (let i = 0; i < commitments.length; ++i) {
      if (commitments[i].preimage.value.bigInt >= value.bigInt) {
        return [commitments[i]];
      }
    }
    return [];
  }

  // Since all commitments has a positive value, if target value is smaller than zero return
  if (value.bigInt <= 0n) return [];

  // We are only interested in subsets of N in which all the commitments are
  // smaller than the target value
  const commitmentsFiltered = commitments.filter(s => s.preimage.value.bigInt < value.bigInt);

  // If there isn't any valid subset of N in which all values are smaller, return
  if (commitmentsFiltered.length < N) return [];

  if (N === 2) {
    return findSubsetTwoCommitments(commitmentsFiltered, value);
  }

  let commitmentsToUse = [];
  let change = Infinity;

  // We will fix a left pointer that will keep moving through the array
  // and then perform a search of two elements with the remaining elements of the array
  for (let i = 0; i <= commitmentsFiltered.length - N; ++i) {
    // Calculate the target value for the two subset search by removing the value of
    // the commitment that is fixed
    const valueLeft = generalise(value.bigInt - commitmentsFiltered[i].preimage.value.bigInt);

    // Try to find a subset of two that matches using valueLeft as the target value
    const commitmentsSubset = findSubsetNCommitments(
      N - 1,
      commitmentsFiltered.slice(i + 1),
      valueLeft,
    );

    // It is possible that there are no possible solutions. Therefore, check first if it has find
    // a solution by checking that it is a non void array
    if (commitmentsSubset.length === N - 1) {
      const sumSubsetCommitment = commitmentsSubset.reduce(
        (acc, com) => acc + com.preimage.value.bigInt,
        commitmentsFiltered[i].preimage.value.bigInt,
      );

      // If an exact solution is found, return
      if (sumSubsetCommitment === value.bigInt)
        return [commitmentsFiltered[i], ...commitmentsSubset];

      // Work out what the change to the value smallest commit we used is.
      const tempChange = sumSubsetCommitment - value.bigInt;

      if (tempChange < change) {
        // We have a set of commitments that has a lower negative change in our outputs.
        change = tempChange;
        commitmentsToUse = [commitmentsFiltered[i], ...commitmentsSubset];
      }
    }
  }

  return commitmentsToUse;
}

function selectCommitments(commitments, value, minC, maxC) {
  const possibleSubsetsCommitments = [];

  // Get the "best" subset of each possible size to then decide which one is better overall
  // From the calculations performed in "verifyEnoughCommitments" we know that at least
  // minC commitments are required. On the other hand, we can use a maximum of maxC commitments
  // but we have to take into account that some spots needs to be used for the fee and that
  // maybe the user does not have as much commitments
  for (let i = minC; i <= Math.min(commitments.length, maxC); ++i) {
    const subset = findSubsetNCommitments(i, commitments, value);
    possibleSubsetsCommitments.unshift(subset);
  }

  // Rank the possible commitments subsets.
  // We prioritize the subset that minimizes the change.
  // If two subsets have the same change, we priority the subset that uses more commitments
  const rankedSubsetCommitmentsArray = possibleSubsetsCommitments
    .filter(subset => subset.length > 0)
    .sort((a, b) => {
      const changeA = a.reduce((acc, com) => acc + com.preimage.value.bigInt, 0n) - value.bigInt;
      const changeB = b.reduce((acc, com) => acc + com.preimage.value.bigInt, 0n) - value.bigInt;
      if (changeA - changeB === 0n) {
        return b.length - a.length;
      }

      return changeA > changeB ? 0 : -1;
    });

  // Select the first ranked subset as the commitments the user will spend
  return rankedSubsetCommitmentsArray.length > 0 ? rankedSubsetCommitmentsArray[0] : [];
}

async function findUsableCommitments(
  compressedZkpPublicKey,
  ercAddress,
  tokenId,
  ercAddressFee,
  _value,
  _fee,
  maxNullifiers,
  maxNonFeeNullifiers,
) {
  const value = generalise(_value); // sometimes this is sent as a BigInt.
  const fee = generalise(_fee); // sometimes this is sent as a BigInt.

  const commitmentsVerification = await verifyEnoughCommitments(
    compressedZkpPublicKey,
    ercAddress,
    tokenId,
    value,
    ercAddressFee,
    fee,
    maxNullifiers,
    maxNonFeeNullifiers,
  );

  const { commitments, minC, minFc, commitmentsFee } = commitmentsVerification;

  logger.debug(
    `The user has ${commitments.length} commitments and needs to use at least ${minC} commitments to perform the transfer`,
  );

  if (fee.bigInt > 0n) {
    logger.debug(
      `The user has ${commitmentsFee.length} commitments and needs to use at least ${minFc} commitments to pay for the fee`,
    );
  }

  const maxC = Math.min(maxNonFeeNullifiers, maxNullifiers - minFc);
  const oldCommitments =
    maxNonFeeNullifiers !== 0 ? selectCommitments(commitments, value, minC, maxC) : [];

  const maxFc = maxNullifiers - oldCommitments.length;
  const oldCommitmentsFee =
    fee.bigInt > 0n ? selectCommitments(commitmentsFee, fee, minFc, maxFc) : [];

  // Mark all the commitments used as pending so that they can not be used twice
  await Promise.all(
    [...oldCommitments, ...oldCommitmentsFee].map(commitment => markPending(commitment)),
  );

  return { oldCommitments, oldCommitmentsFee };
}

// mutex for the above function to ensure it only runs with a concurrency of one
export async function findUsableCommitmentsMutex(
  compressedZkpPublicKey,
  ercAddress,
  tokenId,
  ercAddressFee,
  _value,
  _fee,
  maxNullifiers,
  maxNonFeeNullifiers,
) {
  return mutex.runExclusive(async () =>
    findUsableCommitments(
      compressedZkpPublicKey,
      ercAddress,
      tokenId,
      ercAddressFee,
      _value,
      _fee,
      maxNullifiers,
      maxNonFeeNullifiers,
    ),
  );
}

/**
 *
 * @function insertCommitmentsAndResync save a list of commitments in the database
 * @param {[]} listOfCommitments a list of commitments to be saved in the database
 * @throws if all the commitments in the list already exists in the database
 * throw an error
 * @returns return a success message.
 */
export async function insertCommitmentsAndResync(listOfCommitments) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);

  // 1. listOfCommitments => get only the ids
  const commitmentsIds = listOfCommitments.map(commitment => commitment._id);

  // 2. Find commitments that already exists in DB
  const commitmentsFromDb = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ _id: { $in: commitmentsIds } })
    .toArray();

  // 3. remove the commitments found in the database from the list
  const onlyNewCommitments = listOfCommitments.filter(
    commitment =>
      commitmentsFromDb.find(commitmentFound => commitmentFound._id === commitment._id) ===
      undefined,
  );

  if (onlyNewCommitments.length > 0) {
    // 4. Insert all
    await db.collection(COMMITMENTS_COLLECTION).insertMany(onlyNewCommitments);

    // 5. Sycronize from beggining
    await syncState();

    return { successMessage: 'Commitments have been saved successfully!' };
  }

  throw new Error('All commitments of this list already exists in the database!');
}

/**
 * @function getCommitmentsByCompressedZkpPublicKeyList do the role of a service taking care of the
 * business logic and of a repository doing the communication with the database for this
 * use case.
 * @param {string[]} listOfCompressedZkpPublicKey a list of compressedZkpPublicKey derivated from the user
 * mnemonic coming from the SDK or Wallet.
 * @returns all the commitments existent for this list of compressedZkpPublicKey.
 */
export async function getCommitmentsByCompressedZkpPublicKeyList(listOfCompressedZkpPublicKey) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitmentsByListOfCompressedZkpPublicKey = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      compressedZkpPublicKey: { $in: listOfCompressedZkpPublicKey },
    })
    .toArray();
  return commitmentsByListOfCompressedZkpPublicKey;
}

export async function getCommitmentsByHash(hashes, compressedZkpPublicKey, ercAddress, tokenId) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  logger.debug({
    msg: 'DB lookup',
    compressedZkpPublicKey: compressedZkpPublicKey.hex(32),
    'preimage.ercAddress': generalise(ercAddress).hex(32),
    'preimage.tokenId': generalise(tokenId).hex(32),
    isNullified: false,
    isPendingNullification: false,
  });
  const commitment = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      _id: { $in: hashes },
      compressedZkpPublicKey: compressedZkpPublicKey.hex(32),
      'preimage.ercAddress': generalise(ercAddress).hex(32),
      'preimage.tokenId': generalise(tokenId).hex(32),
      isNullified: false,
      isPendingNullification: false,
    })
    .toArray();
  return commitment;
}

/**
 * @function getCommitments do the role of a service taking care of the
 * business logic and of a repository doing the communication with the database for this
 * use case.
 * @returns all the commitments existent in this database.
 */
export async function getCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const allCommitments = await db.collection(COMMITMENTS_COLLECTION).find().toArray();
  return allCommitments;
}
