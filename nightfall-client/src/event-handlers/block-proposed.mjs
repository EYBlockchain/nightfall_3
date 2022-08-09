import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Timber from 'common-files/classes/timber.mjs';
import getTimeByBlock from 'common-files/utils/block-info.mjs';
import constants from 'common-files/constants/index.mjs';
import {
  markNullifiedOnChain,
  markOnChain,
  countCommitments,
  countNullifiers,
  setSiblingInfo,
  countWithdrawTransactionHashes,
  isTransactionHashWithdraw,
} from '../services/commitment-storage.mjs';
import getProposeBlockCalldata from '../services/process-calldata.mjs';
import { zkpPrivateKeys, nullifierKeys } from '../services/keys.mjs';
import {
  getLatestTree,
  saveTree,
  saveTransaction,
  saveBlock,
  setTransactionHashSiblingInfo,
} from '../services/database.mjs';
import { decryptCommitment } from '../services/commitment-sync.mjs';

const { TIMBER_HEIGHT, TXHASH_TREE_HEIGHT, HASH_TYPE, TXHASH_TREE_HASH_TYPE } = config;
const { ZERO } = constants;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, syncing) {
  // zkpPrivateKey will be used to decrypt secrets whilst nullifierKey will be used to calculate nullifiers for commitments and store them
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { transactions, block } = await getProposeBlockCalldata(data);
  logger.info(
    `Received Block Proposed event with layer 2 block number ${block.blockNumberL2} and tx hash ${transactionHashL1}`,
  );
  const latestTree = await getLatestTree();
  const blockCommitments = transactions
    .map(t => [...t.commitments, ...t.commitmentFee].filter(c => c !== ZERO))
    .flat(Infinity);

  let timeBlockL2 = await getTimeByBlock(transactionHashL1);
  timeBlockL2 = new Date(timeBlockL2 * 1000);

  const dbUpdates = transactions.map(async transaction => {
    let saveTxToDb = false;

    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = [...transaction.commitments].flat(Infinity).filter(n => n !== ZERO);
    const nonZeroNullifiers = [...transaction.nullifiers].flat(Infinity).filter(n => n !== ZERO);

    // filter out non zero commitments fee and nullifiers fee
    const nonZeroCommitmentsFee = [...transaction.commitmentFee]
      .flat(Infinity)
      .filter(n => n !== ZERO);
    const nonZeroNullifiersFee = [...transaction.nullifiersFee]
      .flat(Infinity)
      .filter(n => n !== ZERO);

    const countOfNonZeroCommitments = await countCommitments(nonZeroCommitments);
    const countOfNonZeroNullifiers = await countNullifiers(nonZeroNullifiers);

    if (transaction.transactionType === '1') {
      if (countOfNonZeroCommitments === 0) {
        await decryptCommitment(transaction, zkpPrivateKeys, nullifierKeys)
          .then(isDecrypted => {
            // case when one of user is recipient of transfer transaction
            if (isDecrypted) {
              saveTxToDb = true;
            }
          })
          .catch(err => {
            // case when transfer transaction created by user
            if (countOfNonZeroNullifiers >= 1) {
              saveTxToDb = true;
            } else {
              logger.error(err);
            }
          });
      } else {
        // case when user has transferred to himself
        saveTxToDb = true;
      }
    } else if (transaction.transactionType === '0' && countOfNonZeroCommitments >= 1) {
      // case when deposit transaction created by user
      saveTxToDb = true;
    } else if (transaction.transactionType === '2' && countOfNonZeroNullifiers >= 1) {
      // case when withdraw transaction created by user
      saveTxToDb = true;
    }

    if (saveTxToDb) {
      logger.info('Saving Tx', transaction.transactionHash);
      await saveTransaction({
        transactionHashL1,
        blockNumber: data.blockNumber,
        blockNumberL2: block.blockNumberL2,
        timeBlockL2,
        ...transaction,
      }).catch(function (err) {
        if (!syncing || !err.message.includes('replay existing transaction')) throw err;
        logger.warn('Attempted to replay existing transaction. This is expected while syncing');
      });
    }

    return Promise.all([
      saveTxToDb,
      markOnChain(
        [...nonZeroCommitments, ...nonZeroCommitmentsFee],
        block.blockNumberL2,
        data.blockNumber,
        data.transactionHash,
      ),
      markNullifiedOnChain(
        [...nonZeroNullifiers, ...nonZeroNullifiersFee],
        block.blockNumberL2,
        data.blockNumber,
        data.transactionHash,
      ),
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
