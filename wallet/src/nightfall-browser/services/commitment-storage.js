/* ignore unused exports */

/**
Logic for storing and retrieving commitments from a mongo DB.  Abstracted from
deposit/transfer/withdraw
*/
import { Mutex } from 'async-mutex';
import gen from 'general-number';
import { openDB } from 'idb';
import { Commitment, Nullifier } from '../classes/index';
// eslint-disable-next-line import/no-cycle
import { isValidWithdrawal } from './valid-withdrawal';
import { getBlockByBlockNumberL2, getTransactionByTransactionHash } from './database';

const {
  COMMITMENTS_DB,
  TIMBER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  COMMITMENTS_COLLECTION,
  KEYS_COLLECTION,
  CIRCUIT_COLLECTION,
  CIRCUIT_HASH_COLLECTION,
} = global.config;

const { generalise } = gen;
const mutex = new Mutex();

const connectDB = async () => {
  return openDB(COMMITMENTS_DB, 1, {
    upgrade(newDb) {
      newDb.createObjectStore(COMMITMENTS_COLLECTION);
      newDb.createObjectStore(TIMBER_COLLECTION);
      newDb.createObjectStore(SUBMITTED_BLOCKS_COLLECTION);
      newDb.createObjectStore(TRANSACTIONS_COLLECTION);
      newDb.createObjectStore(KEYS_COLLECTION);
      newDb.createObjectStore(CIRCUIT_COLLECTION);
      newDb.createObjectStore(CIRCUIT_HASH_COLLECTION);
    },
  });
};

// function to format a commitment for a mongo db and store it
export async function storeCommitment(commitment, nullifierKey) {
  const preimage = commitment.preimage.all.hex(32);
  preimage.ercAddress = preimage.ercAddress.toLowerCase();
  const nullifierHash = new Nullifier(commitment, nullifierKey).hash.hex(32);
  const data = {
    _id: commitment.hash.hex(32),
    preimage,
    compressedZkpPublicKey: commitment.compressedZkpPublicKey.hex(32),
    isDeposited: commitment.isDeposited || false,
    isOnChain: Number(commitment.isOnChain) || -1,
    isPendingNullification: false, // will not be pending when stored
    isNullified: commitment.isNullified,
    isNullifiedOnChain: Number(commitment.isNullifiedOnChain) || -1,
    nullifier: nullifierHash,
    blockNumber: -1,
  };
  const db = await connectDB();
  return db.put(COMMITMENTS_COLLECTION, data, data._id);
}
// function to update an existing commitment
export async function updateCommitment(commitment, updates) {
  const db = await connectDB();
  return db.put(COMMITMENTS_COLLECTION, updates, commitment._id);
}

// function to get count of commitments. Can also be used to check if it exists
export async function countCommitments(commitments) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = res.filter(r => commitments.includes(r._id));
  return filtered.length;
}

// function to get count of transaction hashes. Used to decide if we should store
// incoming blocks or transactions.
export async function countTransactionHashes(transactionHashes) {
  const db = await connectDB();
  // const res = await db.getAll(COMMITMENTS_COLLECTION);
  const txs = await db.getAll(TRANSACTIONS_COLLECTION);
  const filtered = txs.filter(tx => transactionHashes.includes(tx.transactionHash));
  // const filtered = res.filter(r => transactionHashes.includes(r.transactionHash));
  return filtered.length;
}

// function to get count of transaction hashes of withdraw type. Used to decide if we should store sibling path of transaction hash to be used later for finalising or instant withdrawal
export async function countWithdrawTransactionHashes(transactionHashes) {
  const db = await connectDB();
  const txs = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = txs.filter(tx => {
    return transactionHashes.includes(tx.transactionHash) && tx.nullifierTransactionType === '2';
  });
  // const filtered = res.filter(r => transactionHashes.includes(r.transactionHash));
  return filtered.length;
}

// function to get if the transaction hash belongs to a withdraw transaction
export async function isTransactionHashWithdraw(transactionHash) {
  const db = await connectDB();
  const txs = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = txs.filter(tx => {
    return tx.transactionHash === transactionHash && tx.nullifierTransactionType === '2';
  });
  return filtered.length;
}

// function to mark a commitments as on chain for a mongo db
export async function markOnChain(
  commitments,
  blockNumberL2,
  blockNumber,
  transactionHashCommittedL1,
) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = res.filter(r => commitments.includes(r._id) && r.isOnChain === -1);
  return Promise.all(
    filtered.map(f => {
      const { isOnChain, blockNumber: oldBN, transactionHashCommittedL1: oldTxHash, ...rest } = f;
      return db.put(
        COMMITMENTS_COLLECTION,
        {
          isOnChain: Number(blockNumberL2),
          blockNumber,
          transactionHashCommittedL1,
          ...rest,
        },
        f._id,
      );
    }),
  );
}

// function to mark a commitments as on chain for a mongo db
export async function setSiblingInfo(commitment, siblingPath, leafIndex, root) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = res.filter(r => r._id === commitment && r.isOnChain !== -1);
  if (filtered.length === 1) {
    const { siblingPath: a, leafIndex: b, root: c, ...rest } = filtered[0];
    return db.put(
      COMMITMENTS_COLLECTION,
      {
        siblingPath,
        leafIndex,
        root,
        ...rest,
      },
      filtered[0]._id,
    );
  }
  return null;
}

// function to mark a commitment as pending nullication for a mongo db
async function markPending(commitment) {
  const db = await connectDB();
  const { isPendingNullification, ...rest } = await db.get(
    COMMITMENTS_COLLECTION,
    commitment.hash.hex(32),
  );
  return db.put(
    COMMITMENTS_COLLECTION,
    {
      isPendingNullification: true,
      ...rest,
    },
    commitment.hash.hex(32),
  );
}

// function to mark a commitment as nullified for a mongo db
export async function markNullified(commitment, transaction) {
  const db = await connectDB();
  const {
    isPendingNullification,
    isNullified,
    nullifierTransactionType,
    transactionHash,
    ...rest
  } = await db.get(COMMITMENTS_COLLECTION, commitment.hash.hex(32));
  return db.put(
    COMMITMENTS_COLLECTION,
    {
      isPendingNullification: false,
      isNullified: true,
      nullifierTransactionType: BigInt(transaction.transactionType).toString(),
      transactionHash: transaction.transactionHash,
      ...rest,
    },
    commitment.hash.hex(32),
  );
}

// function to retrieve commitment with a specified salt
export async function getCommitmentBySalt(salt) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  return res.filter(r => r.preimage.salt === generalise(salt).hex(32));
}

// function to retrieve commitments by transactionHash of the block in which they were
// committed to
export async function getCommitmentsByTransactionHashL1(transactionHashCommittedL1) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  return res.filter(r => r.transactionHashCommittedL1 === transactionHashCommittedL1);
}
// function to retrieve commitments by transactionhash of the block in which they were
// nullified
export async function getNullifiedByTransactionHashL1(transactionHashNullifiedL1) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  return res.filter(r => r.transactionHashNullifiedL1 === transactionHashNullifiedL1);
}
export async function getSiblingInfo(commitment) {
  const db = await connectDB();
  return db.get(COMMITMENTS_COLLECTION, commitment.hash.hex(32));
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
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = res.filter(r => r.isNullifiedOnChain >= Number(blockNumberL2));
  if (filtered.length > 0) {
    return Promise.all(
      filtered.map(f => {
        const { isNullifiedOnChain: a, blockNumber: b, ...rest } = f;
        return db.put(
          COMMITMENTS_COLLECTION,
          {
            isNullifiedOnChain: -1,
            blockNumber: -1,
            ...rest,
          },
          f._id,
        );
      }),
    );
  }
  return null;
}

// as above, but removes isOnChain for deposit commitments
export async function clearOnChain(blockNumberL2) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = res.filter(r => r.isNullifiedOnChain >= Number(blockNumberL2));
  if (filtered.length > 0) {
    return Promise.all(
      filtered.map(f => {
        const { isNullifiedOnChain: a, blockNumber: b, ...rest } = f;
        return db.put(
          COMMITMENTS_COLLECTION,
          {
            isOnChain: -1,
            blockNumber: -1,
            ...rest,
          },
          f._id,
        );
      }),
    );
  }
  return null;
}

// function to clear a commitment as pending nullication for a mongo db
export async function clearPending(commitment) {
  const db = await connectDB();
  const { isPendingNullification: a, ...rest } = await db.get(
    COMMITMENTS_COLLECTION,
    commitment.hash.hex(32),
  );
  return db.put(
    COMMITMENTS_COLLECTION,
    {
      isPendingNullification: false,
      ...rest,
    },
    commitment.hash.hex(32),
  );
}

// function to mark a commitments as nullified on chain for a mongo db
export async function markNullifiedOnChain(
  nullifiers,
  blockNumberL2,
  blockNumber,
  transactionHashNullifiedL1, // the tx in which the nullification happened
) {
  const db = await connectDB();
  const res = await db.getAll(COMMITMENTS_COLLECTION);
  const filtered = res.filter(r => nullifiers.includes(r.nullifier) && r.isNullifiedOnChain === -1);
  if (filtered.length > 0) {
    return Promise.all(
      filtered.map(f => {
        return db.put(
          COMMITMENTS_COLLECTION,
          {
            ...f,
            isNullifiedOnChain: Number(blockNumberL2),
            blockNumber,
            transactionHashNullifiedL1,
          },
          f._id,
        );
      }),
    );
  }
  return null;
}

// function to get the balance of commitments for each ERC address
export async function getWalletBalance(compressedZkpPublicKey) {
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const wallet =
    Object.keys(vals).length > 0
      ? vals.filter(
          v =>
            !v.isNullified &&
            v.isOnChain >= 0 &&
            v.compressedZkpPublicKey === compressedZkpPublicKey,
        )
      : [];
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
      value: BigInt(e.preimage.value),
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
        acc[e.compressedZkpPublicKey][e.ercAddress] = 0n;
      acc[e.compressedZkpPublicKey][e.ercAddress] += e.balance;
      return acc;
    }, {});
}

// function to get the balance of pending deposits commitments for each ERC address
export async function getWalletPendingDepositBalance() {
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const wallet =
    Object.keys(vals).length > 0
      ? vals.filter(v => v.isDeposited && !v.isNullified && v.isOnChain === -1)
      : [];
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

export async function getWalletPendingSpentBalance() {
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const wallet =
    Object.keys(vals).length > 0 ? vals.filter(v => v.isNullified && v.isOnChain === -1) : [];
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
export async function getWalletBalanceDetails(compressedZkpPublicKey, ercList) {
  let ercAddressList = ercList || [];
  ercAddressList = ercAddressList.map(e => e.toUpperCase());
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const wallet =
    Object.keys(vals).length > 0 ? vals.filter(v => !v.isNullified && v.isOnChain >= 0) : [];

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
      tokenId: !!BigInt(e.preimage.tokenId),
      value: Number(BigInt(e.preimage.value)),
      id: Number(BigInt(e.preimage.tokenId)),
    }))
    .filter(
      e =>
        (e.tokenId || e.value > 0) &&
        e.compressedZkpPublicKey === compressedZkpPublicKey &&
        (ercAddressList.length === 0 || ercAddressList.includes(e.ercAddress.toUpperCase())),
    ) // there should be no commitments with tokenId and value of ZERO
    .map(e => ({
      compressedZkpPublicKey: e.compressedZkpPublicKey,
      ercAddress: e.ercAddress,
      balance: e.tokenId ? 1 : e.value,
      tokenId: e.id,
    }))
    .reduce((acc, e) => {
      if (!acc[e.compressedZkpPublicKey]) acc[e.compressedZkpPublicKey] = {};
      if (!acc[e.compressedZkpPublicKey][e.ercAddress])
        acc[e.compressedZkpPublicKey][e.ercAddress] = [];
      if (e.tokenId === 0 && acc[e.compressedZkpPublicKey][e.ercAddress].length > 0) {
        acc[e.compressedZkpPublicKey][e.ercAddress][0].balance += e.balance;
      } else {
        acc[e.compressedZkpPublicKey][e.ercAddress].push({
          balance: e.balance,
          tokenId: e.tokenId,
        });
      }
      return acc;
    }, {});

  return res;
}

// function to get the commitments for each ERC address of a compressedZkpPublicKey
export async function getWalletCommitments() {
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const wallet =
    Object.keys(vals).length > 0 ? vals.filter(v => !v.isNullified && v.isOnChain >= 0) : [];
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
        acc[e.compressedZkpPublicKey][e.ercAddress] = [];
      acc[e.compressedZkpPublicKey][e.ercAddress].push(e);
      return acc;
    }, {});
}

// function to get the withdraw commitments for each ERC address of a compressedZkpPublicKey
export async function getWithdrawCommitments() {
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const withdraws =
    Object.keys(vals).length > 0
      ? vals.filter(v => v.isNullified && v.isOnChain >= 0 && v.nullifierTransactionType === '2')
      : [];

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
      // TODO isValidWithdrawal is called with wrong parameters
      const valid = await isValidWithdrawal(block, transactions, index);
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
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const f = vals.filter(v => commitments.includes(v._id) && v.isOnChain === -1);
  return Promise.all(f.map(deleteC => db.delete(COMMITMENTS_COLLECTION, deleteC._id)));
}

export async function getCommitmentsFromBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  const vals = await db.getAll(COMMITMENTS_COLLECTION);
  const f = vals.filter(v => v.isOnChain >= blockNumberL2);
  return f;
}

async function verifyEnoughCommitments(
  compressedZkpPublicKey,
  ercAddress,
  tokenId,
  value,
  ercAddressFee,
  fee,
) {
  const connection = await connectDB();
  const db = connection.db(COMMITMENTS_DB);

  let fc = 0; // Number of fee commitments
  let minFc = 0; // Minimum number of fee commitments required to pay the fee
  let commitmentsFee = []; // Array containing the fee commitments available sorted

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

    // If not commitments are found, the fee cannot be paid, so return null
    if (commitmentArrayFee === []) return null;

    // Turn the fee commitments into real commitment object and sort it
    commitmentsFee = commitmentArrayFee
      .filter(commitment => Number(commitment.isOnChain) > Number(-1)) // filters for on chain commitments
      .map(ct => new Commitment(ct.preimage))
      .sort((a, b) => Number(a.preimage.value.bigInt - b.preimage.value.bigInt));

    fc = commitmentsFee.length; // Store the number of fee commitments

    // At most, we can use 3 commitments to pay for the fee. However, it is possible that
    // the user has less than 3 matic commitments. Therefore, the maximum number of commitments
    // the user will be able to use is the minimum between 3 and the number of fee commitments (fc)
    const maxPossibleCommitmentsFee = Math.min(fc, 3);

    console.log('maxPossibleCommitments', maxPossibleCommitmentsFee);

    let i = 1;
    let sumHighestCommitmentsFee = 0n;
    // We try to find the minimum number of commitments whose sum is higher than the fee.
    // Since the array is sorted, we just need to try to sum the highest commitments.
    while (i <= maxPossibleCommitmentsFee) {
      console.log('FC', fc);
      console.log('i', i);
      sumHighestCommitmentsFee += commitmentsFee[fc - i].preimage.value.bigInt;
      if (sumHighestCommitmentsFee >= fee.bigInt) {
        minFc = i;
        break;
      }
      ++i;
    }

    // If after the loop minFc is still zero means that we didn't found any sum of commitments
    // higher or equal than the fee required. Therefore the user can not pay it
    if (minFc === 0) return null;
  }

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

  // If not commitments are found, the transfer/withdrawal cannot be paid, so return null
  if (commitmentArray === []) return null;

  // Turn the fee commitments into real commitment object and sort it
  const commitments = commitmentArray
    .filter(commitment => Number(commitment.isOnChain) > Number(-1)) // filters for on chain commitments
    .map(ct => new Commitment(ct.preimage))
    .sort((a, b) => Number(a.preimage.value.bigInt - b.preimage.value.bigInt));

  const c = commitments.length; // Store the number of commitments
  let minC = 0;

  // At most, we can use (4 - number of fee commitments needed) commitments to pay for the
  // transfer or withdraw. However, it is possible that the user doesn't have enough commitments.
  // Therefore, the maximum number of commitments the user will be able to use is the minimum between
  // 4 - minFc and the number of commitments (c)
  const maxPossibleCommitments = Math.min(c, 4 - minFc);

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
  if (minC === 0) return null;

  return { commitmentsFee, minFc, commitments, minC };
}

/**
 * This function find if there is any single commitment
 * whose value is equal or higher.
 */
function findSubsetOneCommitment(commitments, value) {
  for (let i = 0; i < commitments.length; ++i) {
    if (commitments[i].preimage.value.bigInt >= value.bigInt) {
      return [commitments[i]];
    }
  }

  return [];
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

/**
 * This function finds if there is any triplet of commitments
 * whose sum value is equal or higher
 */
function findSubsetThreeCommitments(commitments, value) {
  // Since all commitments has a positive value, if target value is smaller than zero return
  if (value.bigInt <= 0n) return [];

  // We are only interested in subsets of 3 in which all the commitments are
  // smaller than the target value
  const commitmentsFiltered = commitments.filter(s => s.preimage.value.bigInt < value.bigInt);

  // If there isn't any valid subset of 3 in which all values are smaller, return
  if (commitmentsFiltered.length < 3) return [];

  let commitmentsToUse = [];
  let change = Infinity;
  // We will fix a left pointer that will keep moving through the array
  // and then perform a search of two elements with the remaining elements of the array
  for (let i = 0; i < commitmentsFiltered.length - 2; ++i) {
    // Calculate the target value for the two subset search by removing the value of
    // the commitment that is fixed
    const valueLeft = generalise(value.bigInt - commitmentsFiltered[i].preimage.value.bigInt);

    // Try to find a subset of two that matches using valueLeft as the target value
    const twoCommitmentsSum = findSubsetTwoCommitments(commitmentsFiltered.slice(i + 1), valueLeft);

    // It is possible that there are no possible solutions. Therefore, check first if it has find
    // a solution by checking that it is a non void array
    if (twoCommitmentsSum.length !== 0) {
      const sumThreeCommitments =
        commitmentsFiltered[i].preimage.value.bigInt +
        twoCommitmentsSum[0].preimage.value.bigInt +
        twoCommitmentsSum[1].preimage.value.bigInt;

      // If an exact solution is found, return
      if (sumThreeCommitments === value.bigInt)
        return [commitmentsFiltered[i], ...twoCommitmentsSum];

      // Work out what the change to the value smallest commit we used is.
      const tempChange = sumThreeCommitments - value.bigInt;

      if (tempChange < change) {
        // We have a set of commitments that has a lower negative change in our outputs.
        change = tempChange;
        commitmentsToUse = [commitmentsFiltered[i], ...twoCommitmentsSum];
      }
    }
  }

  return commitmentsToUse;
}

/**
 * This function finds if there is any 4 commitments
 * whose sum value is equal or higher
 */
function findSubsetFourCommitments(commitments, value) {
  // Since all commitments has a positive value, if target value is smaller than zero return
  if (value.bigInt <= 0n) return [];

  // We are only interested in subsets of 4 in which all the commitments are
  // smaller than the target value
  const commitmentsFiltered = commitments.filter(s => s.preimage.value.bigInt < value.bigInt);

  // If there isn't any valid subset of 3 in which all values are smaller, return
  if (commitmentsFiltered.length < 4) return [];

  let commitmentsToUse = [];
  let change = Infinity;
  for (let i = 0; i < commitmentsFiltered.length - 3; ++i) {
    // Calculate the target value for the three subset search by removing the value of
    // the commitment that is fixed
    const valueLeft = generalise(value.bigInt - commitmentsFiltered[i].preimage.value.bigInt);

    // Try to find a subset of three that matches using valueLeft as the target value
    const threeCommitmentSum = findSubsetThreeCommitments(
      commitmentsFiltered.slice(i + 1),
      valueLeft,
    );

    // It is possible that there are no possible solutions. Therefore, check first if it has find
    // a solution by checking that it is a non void array
    if (threeCommitmentSum.length !== 0) {
      const sumFourCommitments =
        commitmentsFiltered[i].preimage.value.bigInt +
        threeCommitmentSum[0].preimage.value.bigInt +
        threeCommitmentSum[1].preimage.value.bigInt +
        threeCommitmentSum[2].preimage.value.bigInt;

      // If an exact solution is found, return
      if (sumFourCommitments === value.bigInt)
        return [commitmentsFiltered[i], ...threeCommitmentSum];

      // Work out what the change to the value smallest commit we used is.
      const tempChange = sumFourCommitments - value.bigInt;

      if (tempChange < change) {
        // We have a set of commitments that has a lower negative change in our outputs.
        change = tempChange;
        commitmentsToUse = [commitmentsFiltered[i], ...threeCommitmentSum];
      }
    }
  }

  return commitmentsToUse;
}

/**
 * Given an array of commitments, tries to find a subset of N elements
 * whose sum is equal or higher than the target value
 */
function getSubset(commitments, value, N) {
  let subset = [];
  if (N === 1) {
    subset = findSubsetOneCommitment(commitments, value);
  } else if (N === 2) {
    subset = findSubsetTwoCommitments(commitments, value);
  } else if (N === 3) {
    subset = findSubsetThreeCommitments(commitments, value);
  } else if (N === 4) {
    subset = findSubsetFourCommitments(commitments, value);
  }

  return subset;
}

async function findUsableCommitments(
  compressedZkpPublicKey,
  ercAddress,
  tokenId,
  ercAddressFee,
  _value,
  _fee,
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
  );

  if (!commitmentsVerification) return null;

  const { commitments, minC, minFc, commitmentsFee } = commitmentsVerification;

  const possibleSubsetsCommitments = [];

  // Get the "best" subset of each possible size to then decide which one is better overall
  // From the calculations performed in "verifyEnoughCommitments" we know that at least
  // minC commitments are required. On the other hand, we can use a maximum of 4 commitments
  // but we have to take into account that some spots needs to be used for the fee and that
  // maybe the user does not have as much commitments
  for (let i = minC; i <= Math.min(commitments.length, 4 - minFc); ++i) {
    const subset = getSubset(commitments, value, i);
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

      return Number(changeA - changeB);
    });

  // Select the first ranked subset as the commitments the user will spend
  const oldCommitments = rankedSubsetCommitmentsArray[0];

  const possibleSubsetsCommitmentsFee = [];

  if (fee.bigInt > 0n) {
    // Get the "best" subset of each possible size for the fee to then decide which one
    // is better overall. We know that at least we require minFc commitments.
    // On the other hand, we can use a maximum of 4 commitments minus the spots already used
    // for the regular transfer. We also take into account that the user may not have as much commits
    for (let i = minFc; i <= Math.min(commitmentsFee.length, 4 - oldCommitments.length); ++i) {
      const subset = getSubset(commitmentsFee, fee, i);
      possibleSubsetsCommitmentsFee.unshift(subset);
    }
  }

  // Rank the possible commitments subsets.
  // We prioritize the subset that minimizes the change.
  // If two subsets have the same change, we priority the subset that uses more commitments
  const rankedSubsetCommitmentsFeeArray = possibleSubsetsCommitmentsFee
    .filter(subset => subset.length > 0)
    .sort((a, b) => {
      const changeA = a.reduce((acc, com) => acc + com.preimage.value.bigInt, 0n) - value.bigInt;
      const changeB = b.reduce((acc, com) => acc + com.preimage.value.bigInt, 0n) - value.bigInt;
      if (changeA - changeB === 0n) {
        return b.length - a.length;
      }

      return changeA > changeB ? 0 : -1;
    });

  // If fee was zero, ranked subset will be an empty array and therefore no commitments will be assigned
  // Otherwise, set the best ranked as the commitments to spend
  const oldCommitmentsFee =
    rankedSubsetCommitmentsFeeArray.length > 0 ? rankedSubsetCommitmentsFeeArray[0] : [];

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
) {
  return mutex.runExclusive(async () =>
    findUsableCommitments(compressedZkpPublicKey, ercAddress, tokenId, ercAddressFee, _value, _fee),
  );
}

export async function getAllCommitments() {
  const db = await connectDB();
  return db.getAll(COMMITMENTS_COLLECTION);
}
