/* eslint-disable import/no-cycle */
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Timber from '@polygon-nightfall/common-files/classes/timber.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { getCircuitHash } from '@polygon-nightfall/common-files/utils/worker-calls.mjs';
import { getTimeByBlock } from '@polygon-nightfall/common-files/utils/block-utils.mjs';
import gen from 'general-number';
import {
  markNullifiedOnChain,
  markOnChain,
  countCommitments,
  countNullifiers,
  setSiblingInfo,
  countCircuitTransactions,
  isTransactionHashBelongCircuit,
  deleteNonNullifiedCommitments,
} from '../services/commitment-storage.mjs';
import { getProposeBlockCalldata } from '../services/process-calldata.mjs';
import { zkpPrivateKeys, nullifierKeys } from '../services/keys.mjs';
import {
  getLatestTree,
  saveTree,
  saveTransaction,
  saveBlock,
  setTransactionHashSiblingInfo,
  findDuplicateTransactions,
  deleteTransactionsByTransactionHashes,
} from '../services/database.mjs';
import { decryptCommitment } from '../services/commitment-sync.mjs';

const { TIMBER_HEIGHT, HASH_TYPE, TXHASH_TREE_HASH_TYPE } = config;
const { ZERO, WITHDRAW } = constants;

const { generalise } = gen;

/**
 * This handler runs whenever a BlockProposed event is emitted by the blockchain
 */
async function blockProposedEventHandler(data, syncing) {
  // zkpPrivateKey will be used to decrypt secrets whilst nullifierKey will be used to calculate nullifiers for commitments and store them
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { transactions, block } = await getProposeBlockCalldata(data);

  logger.info({
    msg: 'Received Block Proposed event with Layer 2 Block Number and Tx Hash',
    blockNumberL2: block.blockNumberL2,
    transactions,
    transactionHashL1,
  });

  const latestTree = await getLatestTree();
  const blockCommitments = transactions
    .map(t => t.commitments.filter(c => c !== ZERO))
    .flat(Infinity);

  let timeBlockL2 = await getTimeByBlock(transactionHashL1);
  timeBlockL2 = new Date(timeBlockL2 * 1000);

  const dbUpdates = transactions.map(async transaction => {
    let saveTxToDb = false;
    let duplicateTransactions = []; // duplicate tx holding same commitments or nullifiers

    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transaction.commitments.filter(c => c !== ZERO);
    const nonZeroNullifiers = transaction.nullifiers.filter(n => n !== ZERO);

    const countOfNonZeroCommitments = await countCommitments([nonZeroCommitments[0]]);
    const countOfNonZeroNullifiers = await countNullifiers(nonZeroNullifiers);

    let isDecrypted = false;
    // In order to check if the transaction is a transfer, we check if the compressed secrets
    // are different than zero. All other transaction types have compressedSecrets = [0,0]
    if (
      (transaction.compressedSecrets[0] !== ZERO || transaction.compressedSecrets[1] !== ZERO) &&
      !countOfNonZeroCommitments
    ) {
      const transactionDecrypted = await decryptCommitment(
        transaction,
        zkpPrivateKeys,
        nullifierKeys,
      );
      if (transactionDecrypted) {
        saveTxToDb = true;
        isDecrypted = true;
      }
    }

    if (countOfNonZeroCommitments >= 1 || countOfNonZeroNullifiers >= 1) {
      saveTxToDb = true;
    }

    logger.trace({
      transaction: transaction.transactionHash,
      saveTxToDb,
      countOfNonZeroCommitments,
      countOfNonZeroNullifiers,
    });

    if (saveTxToDb) {
      logger.info({ msg: 'Saving transaction', transaction: transaction.transactionHash });
      await saveTransaction({
        transactionHashL1,
        blockNumber: data.blockNumber,
        blockNumberL2: block.blockNumberL2,
        timeBlockL2,
        ...transaction,
        isDecrypted,
      });

      duplicateTransactions = await findDuplicateTransactions(
        nonZeroCommitments,
        nonZeroNullifiers,
        [transaction.transactionHash],
      );
    }

    logger.info(`-------------xxxxxx-----${duplicateTransactions}`);

    return Promise.all([
      saveTxToDb,
      markOnChain(nonZeroCommitments, block.blockNumberL2, data.blockNumber, data.transactionHash),
      markNullifiedOnChain(
        nonZeroNullifiers,
        block.blockNumberL2,
        data.blockNumber,
        data.transactionHash,
      ),
      deleteTransactionsByTransactionHashes([...duplicateTransactions.map(t => t.transactionHash)]),
      deleteNonNullifiedCommitments([
        ...duplicateTransactions
          .map(t => t.commitments)
          .flat()
          .filter(c => c !== ZERO),
      ]),
    ]);
  });

  await Promise.all(dbUpdates).then(async updateReturn => {
    // only save block if any transaction in it is saved/stored to db
    const saveBlockToDb = updateReturn.map(d => d[0]);
    if (saveBlockToDb.includes(true)) {
      await saveBlock({ blockNumber: currentBlockCount, transactionHashL1, timeBlockL2, ...block });
    }
  });

  const updatedTimber = Timber.statelessUpdate(
    latestTree,
    blockCommitments,
    HASH_TYPE,
    TIMBER_HEIGHT,
  );

  try {
    await saveTree(transactionHashL1, block.blockNumberL2, updatedTimber);
  } catch (err) {
    // while initial syncing we avoid duplicates errors
    if (!syncing || !err.message.includes('duplicate key')) throw err;
  }

  logger.debug({
    msg: 'Saved tree for L2 block',
    blockNumberL2: block.blockNumberL2,
  });

  await Promise.all(
    // eslint-disable-next-line consistent-return
    blockCommitments.map(async (c, i) => {
      const count = await countCommitments([c]);
      if (count > 0) {
        const siblingPath = Timber.statelessSiblingPath(
          latestTree,
          blockCommitments,
          i,
          HASH_TYPE,
          TIMBER_HEIGHT,
        );
        return setSiblingInfo(c, siblingPath, latestTree.leafCount + i, updatedTimber.root);
      }
    }),
  );

  let height = 1;
  while (2 ** height < block.transactionHashes.length) {
    ++height;
  }

  // If this L2 block contains withdraw transactions known to this client,
  // the following needs to be saved for later to be used during finalise/instant withdraw
  // 1. Save sibling path for the withdraw transaction hash that is present in transaction hashes timber tree
  // 2. Save transactions hash of the transactions in this L2 block that contains withdraw transactions for this client
  // transactions hash is a linear hash of the transactions in an L2 block which is calculated during proposeBlock in
  // the contract

  const circuitHash = await getCircuitHash(WITHDRAW);

  const withdrawCircuitHash = generalise(circuitHash).hex(32);

  if ((await countCircuitTransactions(block.transactionHashes, withdrawCircuitHash)) > 0) {
    const transactionHashesTimber = new Timber(...[, , , ,], TXHASH_TREE_HASH_TYPE, height);
    const updatedTransactionHashesTimber = Timber.statelessUpdate(
      transactionHashesTimber,
      block.transactionHashes,
      TXHASH_TREE_HASH_TYPE,
      height,
    );

    await Promise.all(
      // eslint-disable-next-line consistent-return
      block.transactionHashes.map(async (transactionHash, i) => {
        if (await isTransactionHashBelongCircuit(transactionHash, withdrawCircuitHash)) {
          const siblingPathTransactionHash =
            updatedTransactionHashesTimber.getSiblingPath(transactionHash);
          return setTransactionHashSiblingInfo(
            transactionHash,
            siblingPathTransactionHash,
            transactionHashesTimber.leafCount + i,
            updatedTransactionHashesTimber.root,
          );
        }
      }),
    );
  }
}

export default blockProposedEventHandler;
