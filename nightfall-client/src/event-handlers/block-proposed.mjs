import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Timber from 'common-files/classes/timber.mjs';
import {
  markNullifiedOnChain,
  markOnChain,
  countCommitments,
  setSiblingInfo,
  countWithdrawTransactionHashes,
  isTransactionHashWithdraw,
} from '../services/commitment-storage.mjs';
import getProposeBlockCalldata from '../services/process-calldata.mjs';
import { ivks, nsks } from '../services/keys.mjs';
import {
  getLatestTree,
  saveTree,
  saveTransaction,
  saveBlock,
  setTransactionHashSiblingInfo,
} from '../services/database.mjs';
import { decryptCommitment } from '../services/commitment-sync.mjs';

const { ZERO, HASH_TYPE, TIMBER_HEIGHT, TXHASH_TREE_HASH_TYPE, TXHASH_TREE_HEIGHT } = config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, syncing) {
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { transactions, block } = await getProposeBlockCalldata(data);
  logger.info(
    `Received Block Proposed event with layer 2 block number ${block.blockNumberL2} and tx hash ${transactionHashL1}`,
  );
  const latestTree = await getLatestTree();
  const blockCommitments = transactions.map(t => t.commitments.filter(c => c !== ZERO)).flat();

  // if ((await countCommitments(blockCommitments)) > 0) {
  await saveBlock({ blockNumber: currentBlockCount, transactionHashL1, ...block });
  logger.debug(`Saved L2 block ${block.blockNumberL2}, with tx hash ${transactionHashL1}`);
  await Promise.all(
    transactions.map(t =>
      saveTransaction({
        transactionHashL1,
        blockNumber: data.blockNumber,
        blockNumberL2: block.blockNumberL2,
        ...t,
      }).catch(function (err) {
        if (!syncing || !err.message.includes('replay existing transaction')) throw err;
        logger.warn('Attempted to replay existing transaction. This is expected while syncing');
      }),
    ),
  );
  // }

  const dbUpdates = transactions.map(async transaction => {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
    const nonZeroNullifiers = transaction.nullifiers.flat().filter(n => n !== ZERO);
    if (
      (Number(transaction.transactionType) === 1 || Number(transaction.transactionType) === 2) &&
      (await countCommitments(nonZeroCommitments)) === 0
    )
      await decryptCommitment(transaction, ivks, nsks);
    return Promise.all([
      markOnChain(nonZeroCommitments, block.blockNumberL2, data.blockNumber, data.transactionHash),
      markNullifiedOnChain(
        nonZeroNullifiers,
        block.blockNumberL2,
        data.blockNumber,
        data.transactionHash,
      ),
    ]);
  });

  // await Promise.all(toStore);
  await Promise.all(dbUpdates);
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

  logger.debug(`Saved tree for L2 block ${block.blockNumberL2}`);
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

  // If this L2 block contains withdraw transactions known to this client,
  // the following needs to be saved for later to be used during finalise/instant withdraw
  // 1. Save sibling path for the withdraw transaction hash that is present in transaction hashes timber tree
  // 2. Save transactions hash of the transactions in this L2 block that contains withdraw transactions for this client
  // transactions hash is a linear hash of the transactions in an L2 block which is calculated during proposeBlock in
  // the contract
  if ((await countWithdrawTransactionHashes(block.transactionHashes)) > 0) {
    const transactionHashesTimber = new Timber(
      ...[, , , ,],
      TXHASH_TREE_HASH_TYPE,
      TXHASH_TREE_HEIGHT,
    );
    const updatedTransctionHashesTimber = Timber.statelessUpdate(
      transactionHashesTimber,
      block.transactionHashes,
      TXHASH_TREE_HASH_TYPE,
      TXHASH_TREE_HEIGHT,
    );

    await Promise.all(
      // eslint-disable-next-line consistent-return
      block.transactionHashes.map(async (transactionHash, i) => {
        if (await isTransactionHashWithdraw(transactionHash)) {
          const siblingPathTransactionHash =
            updatedTransctionHashesTimber.getSiblingPath(transactionHash);
          return setTransactionHashSiblingInfo(
            transactionHash,
            siblingPathTransactionHash,
            transactionHashesTimber.leafCount + i,
            updatedTransctionHashesTimber.root,
          );
        }
      }),
    );
  }
}

export default blockProposedEventHandler;
