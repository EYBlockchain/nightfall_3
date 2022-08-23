/* eslint-disable import/no-cycle */
/**
Logic for storing and retrieving commitments from a mongo DB.  Abstracted from
deposit/transfer/withdraw
*/
import config from 'config';
import { Mutex } from 'async-mutex';
import gen from 'general-number';
import mongo from 'common-files/utils/mongo.mjs';
import logger from 'common-files/utils/logger.mjs';
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
  const data = {
    _id: commitment.hash.hex(32),
    compressedZkpPublicKey: commitment.compressedZkpPublicKey.hex(32),
    preimage: commitment.preimage.all.hex(32),
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

// // function to get count of transaction hashes. Used to decide if we should store
// // incoming blocks or transactions.
// export async function countTransactionHashes(transactionHashes) {
//   const connection = await mongo.connection(MONGO_URL);
//   const query = { transactionHash: { $in: transactionHashes } };
//   const db = connection.db(COMMITMENTS_DB);
//   return db.collection(COMMITMENTS_COLLECTION).countDocuments(query);
// }

// function to get count of transaction hashes of withdraw type. Used to decide if we should store sibling path of transaction hash to be used later for finalising or instant withdrawal
export async function countWithdrawTransactionHashes(transactionHashes) {
  const connection = await mongo.connection(MONGO_URL);
  const query = {
    transactionHash: { $in: transactionHashes },
    nullifierTransactionType: '2',
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).countDocuments(query);
}

// function to get if the transaction hash belongs to a withdraw transaction
export async function isTransactionHashWithdraw(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { transactionHash, nullifierTransactionType: '2' };
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
async function markPending(commitment) {
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
      nullifierTransactionType: BigInt(transaction.transactionType).toString(),
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
  // const query = { isOnChain: { $gte: Number(blockNumberL2) }, isDeposited: true };
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
    projection: {
      compressedZkpPublicKey: 1,
      preimage: { ercAddress: 1, tokenId: 1, value: 1 },
      _id: 0,
    },
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
    projection: {
      compressedZkpPublicKey: 1,
      preimage: { ercAddress: 1, tokenId: 1, value: 1 },
      _id: 0,
    },
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
    projection: {
      compressedZkpPublicKey: 1,
      preimage: { ercAddress: 1, tokenId: 1, value: 1 },
      _id: 0,
    },
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
        e.value > 0 &&
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
    projection: {
      compressedZkpPublicKey: 1,
      preimage: { ercAddress: 1, tokenId: 1, value: 1 },
      _id: 0,
    },
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
        e.value > 0 &&
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
export async function getWalletCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isNullified: false, isOnChain: { $gte: 0 } };
  const options = {
    projection: {
      compressedZkpPublicKey: 1,
      preimage: { ercAddress: 1, tokenId: 1, value: 1 },
      _id: 0,
    },
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
    .filter(e => e.tokenId || e.value > 0) // there should be no commitments with tokenId and value of ZERO
    .map(e => ({
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      ercAddress: e.ercAddress,
      balance: e.value,
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
export async function getWithdrawCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = {
    isNullified: true,
    nullifierTransactionType: '2',
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

// function to find commitments that can be used in the proposed transfer
// We want to make sure that only one process runs this at a time, otherwise
// two processes may pick the same commitment. Thus we'll use a mutex lock and
// also mark any found commitments as nullified (TODO mark them as un-nullified
// if the transaction errors). The mutex lock is in the function
// findUsableCommitmentsMutex, which calls this function.
async function findUsableCommitments(compressedZkpPublicKey, ercAddress, tokenId, _value) {
  const value = generalise(_value); // sometimes this is sent as a BigInt.
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
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

  if (commitmentArray === []) return null;
  // turn the commitments into real commitment objects
  const commitments = commitmentArray
    .filter(commitment => Number(commitment.isOnChain) > Number(-1)) // filters for on chain commitments
    .map(ct => new Commitment(ct.preimage));
  // if we have an exact match, we can do a single-commitment transfer.
  const [singleCommitment] = commitments.filter(c => c.preimage.value.hex(32) === value.hex(32));
  if (singleCommitment) {
    logger.info('Found commitment suitable for single transfer or withdraw');
    await markPending(singleCommitment);
    return [singleCommitment];
  }

  // If there is only 1 commitment - then we should try a single transfer with change
  if (commitments.length === 1) {
    if (commitments[0].preimage.value.bigInt > value.bigInt) {
      await markPending(commitments[0]);
      return commitments;
    }
    return null;
  }

  /* The current strategy aims to prioritise reducing the complexity of the commitment set. 
    I.e. Minimise the size of the commitment set by using smaller commitments while also 
    minimising the creation of low value commitments (dust).

    Transaction type in order of priority. (1) Double transfer without change, (2) Double Transfer with change, (3) Single Transfer with change.

    Double Transfer Without Change:
    1) Sort all commitments by value
    2) Find candidate pairs of commitments that equal the transfer sum.
    3) Select candidate that uses the smallest commitment as one of the input.

    Double Transfer With Change:
    1) Sort all commitments by value
    2) Split commitments into two sets based of if their values are less than or greater than the target value. LT & GT respectively.
    3) If the sum of the two largest values in set LT is LESS than the target value:
      i) We cannot arrive at the target value with two elements in this set.
      ii) Our two selected commitments will be the smallest commitment in LT and in smallest commitment in GT.
      iii) It is guaranteed that the output (change) commitments will be larger than the input commitment from LT.

    5) If the sum of the two largest values in set LT is GREATER than the target value:
      i) We use a standard inward search whereby we begin with a pointer, lhs & rhs at the start and end of the LT.
      ii) We also track the change difference, this is the change in size of the smallest commitment in this set resulting from this transaction's output.
      iii) If the sum of the commitments at the pointers is greater than the target value, we move pointer rhs to the left.
      iv) Otherwise, we move pointer lhs to the right.
      v) The selected commitments are the pair that minimise the change difference. The best case in this scenario is a change difference of -1.

    Single Transfer With Change:
    1) If this is the only commitment and it is greater than the transfer sum.
  */

  // sorting will help with making the search easier
  const sortedCommits = commitments.sort((a, b) =>
    Number(a.preimage.value.bigInt - b.preimage.value.bigInt),
  );

  // Find two commitments that matches the transfer value exactly. Double Transfer With No Change.
  let lhs = 0;
  let rhs = sortedCommits.length - 1;
  let commitmentsToUse = null;
  while (lhs < rhs) {
    const tempSum = sortedCommits[lhs].bigInt + sortedCommits[rhs].bigInt;
    // The first valid solution will include the smallest usable commitment in the set.
    if (tempSum === value.bigInt) {
      commitmentsToUse = [sortedCommits[lhs], sortedCommits[rhs]];
      break;
    }

    if (tempSum > value.bigInt) rhs--;
    else lhs++;
  }

  // If we have found two commitments that match the transfer value, mark them as pending and return
  if (commitmentsToUse) {
    await Promise.all(commitmentsToUse.map(commitment => markPending(commitment)));
    return commitmentsToUse;
  }

  // Find two commitments are greater than the target. Double Transfer With Change
  // get all commitments less than the target value
  const commitsLessThanTargetValue = sortedCommits.filter(
    s => s.preimage.value.bigInt < value.bigInt,
  );
  // get the sum of the greatest two values in this set
  const twoGreatestSum = commitsLessThanTargetValue
    .slice(commitsLessThanTargetValue.length - 2)
    .reduce((acc, curr) => acc + curr.preimage.value.bigInt, 0n);
  // If the sum of the two greatest values that are less than the target value is STILL less than the target value
  // then we will need to use a commitment of greater value than the target
  if (twoGreatestSum < value.bigInt) {
    if (commitsLessThanTargetValue.length === sortedCommits.length) return null; // We don't have any more commitments
    commitmentsToUse =
      commitsLessThanTargetValue.length === 0
        ? [(sortedCommits[0], sortedCommits[1])] // return smallest in GT if LT array is empty
        : [sortedCommits[commitsLessThanTargetValue.length], sortedCommits[0]]; // This should guarantee that we will replace our smallest commitment with a greater valued one.
    await Promise.all(commitmentsToUse.map(commitment => markPending(commitment)));
    return commitmentsToUse; // return smallest in GT if LT array is empty
  }

  // If we are here than we can use our commitments less than the target value to sum to greater than the target value
  lhs = 0;
  rhs = commitsLessThanTargetValue.length - 1;
  let changeDiff = -Infinity;
  commitmentsToUse = null;
  while (lhs < rhs) {
    const tempSum =
      commitsLessThanTargetValue[lhs].preimage.value.bigInt +
      commitsLessThanTargetValue[rhs].preimage.value.bigInt;
    // Work out what the change to the value smallest commit we used is
    // This value will always be negative,
    // this is equivalent to  tempSum - value.bigInt - commitsLessThanTargetValue[lhs].preimage.value.bigInt
    const tempChangeDiff = commitsLessThanTargetValue[rhs].preimage.value.bigInt - value.bigInt;
    if (tempSum >= value.bigInt) {
      if (tempChangeDiff > changeDiff) {
        // We have a set of commitments that has a lower negative change in our outputs.
        changeDiff = tempChangeDiff;
        commitmentsToUse = [commitsLessThanTargetValue[lhs], commitsLessThanTargetValue[rhs]];
      }
      rhs--;
    } else lhs++;
  }
  if (commitmentsToUse) {
    logger.info(
      `Found commitments suitable for two-token transfer: ${JSON.stringify(commitmentsToUse)}`,
    );
    await Promise.all(commitmentsToUse.map(commitment => markPending(commitment)));
    return commitmentsToUse;
  }
  return null;
}

// mutex for the above function to ensure it only runs with a concurrency of one
export async function findUsableCommitmentsMutex(
  compressedZkpPublicKey,
  ercAddress,
  tokenId,
  _value,
) {
  return mutex.runExclusive(async () =>
    findUsableCommitments(compressedZkpPublicKey, ercAddress, tokenId, _value),
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
      commitmentsFromDb.find(commitmentFound => commitmentFound.id === commitment.id) === undefined,
  );

  if (onlyNewCommitments.length) {
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
