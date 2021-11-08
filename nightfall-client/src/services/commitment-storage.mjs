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
import { getBlockByTransactionHash } from '../utils/optimist.mjs';
import { isValidWithdrawal } from './valid-withdrawal.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const { generalise } = gen;
const mutex = new Mutex();

// function to format a commitment for a mongo db and store it
export async function storeCommitment(commitment, nsk) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  // we'll also compute and store the nullifier hash.  This will be useful for
  // spotting if the commitment spend is ever rolled back, which would mean the
  // commitment is once again available to spend
  const nullifierHash = new Nullifier(commitment, nsk).hash.hex(32);
  const data = {
    _id: commitment.hash.hex(32),
    preimage: commitment.preimage.all.hex(32),
    isDeposited: commitment.isDeposited || false,
    isOnChain: Number(commitment.isOnChain) || -1,
    isPendingNullification: false, // will not be pending when stored
    isNullified: commitment.isNullified,
    isNullifiedOnChain: Number(commitment.isNullifiedOnChain),
    nullifier: nullifierHash,
    blockNumber: -1,
    transactionNullified: null,
  };
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

// function to get count of nullifiers. Can also be used to check if it exists
export async function countNullifiers(nullifiers) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { nullifier: { $in: nullifiers } };
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
    $set: { isPendingNullification: false, isNullified: true, transactionNullified: transaction },
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

// function to retrieve commitment by transactionHash of the block in which it was
// committed to
export async function getCommitmentsByTransactionHashL1(transactionHashCommittedL1) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).find({ transactionHashCommittedL1 }).toArray();
}

// function to retrieve the output commitments from a nullified input commitment
export async function getOutputCommitmentsByTransactionHashL1(transactionHashCommittedL1) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { transactionHashCommittedL1, transactionHashNullified: { $exists: true } };
  const options = { projection: { transactionHashNullified: 1, _id: 0 } };
  const transactionHashesNullified = await db
    .collection(COMMITMENTS_COLLECTION)
    .find(query, options)
    .toArray();
  const outputCommitments = transactionHashesNullified.map(t =>
    getCommitmentsByTransactionHashL1(t),
  );
  return Promise.all(outputCommitments);
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
    // $set: { isNullifiedOnChain: -1, isNullified: false, isPendingNullification: false },
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
  transactionHashNullifiedL1,
) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { nullifier: { $in: nullifiers }, isNullifiedOnChain: { $eq: -1 } };
  const update = {
    $set: { isNullifiedOnChain: Number(blockNumberL2), blockNumber, transactionHashNullifiedL1 },
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateMany(query, update);
}

export async function getAllCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).find().toArray();
}

// function to get the balance of commitments for each ERC address
export async function getWalletBalance() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isNullified: false, isOnChain: { $gte: 0 } };
  const options = {
    projection: {
      preimage: { ercAddress: 1, compressedPkd: 1, tokenId: 1, value: 1 },
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
      ercAddress: BigInt(e.preimage.ercAddress).toString(16),
      compressedPkd: e.preimage.compressedPkd,
      tokenId: !!BigInt(e.preimage.tokenId),
      value: Number(BigInt(e.preimage.value)),
    }))
    .filter(e => e.tokenId || e.value > 0) // there should be no commitments with tokenId and value of ZERO
    .map(e => ({
      compressedPkd: e.compressedPkd,
      ercAddress: e.ercAddress,
      balance: e.tokenId ? 1 : e.value,
    }))
    .reduce((acc, e) => {
      if (!acc[e.compressedPkd]) acc[e.compressedPkd] = {};
      if (!acc[e.compressedPkd][e.ercAddress]) acc[e.compressedPkd][e.ercAddress] = 0;
      acc[e.compressedPkd][e.ercAddress] += e.balance;
      return acc;
    }, {});
}

// function to get the commitments for each ERC address of a pkd
export async function getWalletCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { isNullified: false, isOnChain: { $gte: 0 } };
  const options = {
    projection: {
      preimage: { ercAddress: 1, compressedPkd: 1, tokenId: 1, value: 1 },
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
      ercAddress: BigInt(e.preimage.ercAddress).toString(16),
      compressedPkd: e.preimage.compressedPkd,
      tokenId: !!BigInt(e.preimage.tokenId),
      value: Number(BigInt(e.preimage.value)),
    }))
    .filter(e => e.tokenId || e.value > 0) // there should be no commitments with tokenId and value of ZERO
    .map(e => ({
      compressedPkd: e.compressedPkd,
      ercAddress: e.ercAddress,
      balance: e.tokenId ? 1 : e.value,
    }))
    .reduce((acc, e) => {
      if (!acc[e.compressedPkd]) acc[e.compressedPkd] = {};
      if (!acc[e.compressedPkd][e.ercAddress]) acc[e.compressedPkd][e.ercAddress] = [];
      acc[e.compressedPkd][e.ercAddress].push(e);
      return acc;
    }, {});
}

// function to get the withdraw commitments for each ERC address of a pkd
export async function getWithdrawCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = {
    isNullified: true,
    'transactionNullified.transactionType':
      '0x0000000000000000000000000000000000000000000000000000000000000003',
  };
  const options = {
    projection: {
      preimage: { ercAddress: 1, compressedPkd: 1, tokenId: 1, value: 1 },
      _id: 0,
      transactionNullified: 1,
    },
  };
  const withdraws = await db.collection(COMMITMENTS_COLLECTION).find(query, options).toArray();
  const withdrawsDetails = withdraws
    .map(e => ({
      ercAddress: BigInt(e.preimage.ercAddress).toString(16),
      compressedPkd: e.preimage.compressedPkd,
      tokenId: !!BigInt(e.preimage.tokenId),
      value: Number(BigInt(e.preimage.value)),
      transactionNullified: e.transactionNullified,
    }))
    .filter(e => e.tokenId || e.value > 0) // there should be no commitments with tokenId and value of ZERO
    .map(e => ({
      compressedPkd: e.compressedPkd,
      ercAddress: e.ercAddress,
      balance: e.tokenId ? 1 : e.value,
      transactionNullified: e.transactionNullified,
    }));

  const withdrawsDetailsValid = await Promise.all(
    withdrawsDetails.map(async e => {
      let valid = false;

      try {
        const { block, transactions, index } = await getBlockByTransactionHash(
          e.transactionNullified.transactionHash,
        );
        try {
          const res = await isValidWithdrawal({ block, transactions, index });
          valid = res;
        } catch (ex) {
          valid = false;
        }
      } catch (ex) {
        valid = false;
      }
      return {
        compressedPkd: e.compressedPkd,
        ercAddress: e.ercAddress,
        balance: e.balance,
        transactionNullified: e.transactionNullified,
        valid,
      };
    }),
  );

  return withdrawsDetailsValid.reduce((acc, e) => {
    if (!acc[e.compressedPkd]) acc[e.compressedPkd] = {};
    if (!acc[e.compressedPkd][e.ercAddress]) acc[e.compressedPkd][e.ercAddress] = [];
    acc[e.compressedPkd][e.ercAddress].push(e);
    return acc;
  }, {});
}

// as above, but removes output commitments
export async function deleteCommitments(commitmentHashes) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: { $in: commitmentHashes } };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).deleteMany(query);
}

// function to find commitments that can be used in the proposed transfer
// We want to make sure that only one process runs this at a time, otherwise
// two processes may pick the same commitment. Thus we'll use a mutex lock and
// also mark any found commitments as nullified (TODO mark them as un-nullified
// if the transaction errors). The mutex lock is in the function
// findUsableCommitmentsMutex, which calls this function.
async function findUsableCommitments(compressedPkd, ercAddress, tokenId, _value, onlyOne) {
  const value = generalise(_value); // sometimes this is sent as a BigInt.
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitmentArray = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      'preimage.compressedPkd': compressedPkd.hex(32),
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
  // If we get here it means that we have not been able to find a single commitment that matches the required value
  if (onlyOne) return null; // sometimes we require just one commitment

  /* if not, maybe we can do a two-commitment transfer. The current strategy aims to prioritise smaller commitments while also
     minimising the creation of low value commitments (dust)

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
  */

  // sorting will help with making the search easier
  const sortedCommits = commitments.sort((a, b) =>
    Number(a.preimage.value.bigInt - b.preimage.value.bigInt),
  );

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
    return [sortedCommits[commitsLessThanTargetValue.length], sortedCommits[0]]; // This should guarantee that we will replace our smallest commitment with a greater valued one.
  }

  // If we are here than we can use our commitments less than the target value to sum to greater than the target value
  let lhs = 0;
  let rhs = commitsLessThanTargetValue.length - 1;
  let changeDiff = -Infinity;
  let commitmentsToUse = null;
  while (lhs < rhs) {
    const tempSum =
      commitsLessThanTargetValue[lhs].preimage.value.bigInt +
      commitsLessThanTargetValue[rhs].preimage.value.bigInt;
    // Work out what the change to the value smallest commit we used is
    // This value will always be negative,
    // this is equivalent to  tempSum - value.bigInt - commitsLessThanTargetValue[lhs].preimage.value.bigInt
    const tempChangeDiff = commitsLessThanTargetValue[rhs].preimage.value.bigInt - value.bigInt;
    if (tempSum > value.bigInt) {
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
  }
  await Promise.all(commitmentsToUse.map(commitment => markPending(commitment)));
  return commitmentsToUse;
}

// mutex for the above function to ensure it only runs with a concurrency of one
export async function findUsableCommitmentsMutex(
  compressedPkd,
  ercAddress,
  tokenId,
  _value,
  onlyOne,
) {
  return mutex.runExclusive(async () =>
    findUsableCommitments(compressedPkd, ercAddress, tokenId, _value, onlyOne),
  );
}
