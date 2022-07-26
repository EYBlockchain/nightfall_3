// ignore unused exports default

import logger from '../../common-files/utils/logger';
import Timber from '../../common-files/classes/timber';
import {
  markNullifiedOnChain,
  markOnChain,
  storeCommitment,
  countCommitments,
  setSiblingInfo,
  countTransactionHashes,
  countWithdrawTransactionHashes,
  isTransactionHashWithdraw,
} from '../services/commitment-storage';
// import getProposeBlockCalldata from '../services/process-calldata';
import Secrets from '../classes/secrets';
// import { ivks, nsks } from '../services/keys';
import {
  getTreeByBlockNumberL2,
  saveTree,
  saveTransaction,
  saveBlock,
  setTransactionHashSiblingInfo,
  updateTransactionTime,
} from '../services/database';

const { ZERO, HASH_TYPE, TIMBER_HEIGHT, TXHASH_TREE_HASH_TYPE, TXHASH_TREE_HEIGHT } = global.config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, ivks, nsks) {
  console.log(`Received Block Proposed event: ${JSON.stringify(data)}`);
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { transactions, block, blockTimestamp } = data;
  const latestTree = await getTreeByBlockNumberL2(block.blockNumberL2 - 1);
  const blockCommitments = transactions.map(t => t.commitments.filter(c => c !== ZERO)).flat();
  let isTxDecrypt = false;

  const dbUpdates = transactions.map(async transaction => {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
    const nonZeroNullifiers = transaction.nullifiers.flat().filter(n => n !== ZERO);
    const storeCommitments = [];
    const tempTransactionStore = [];
    if (
      (Number(transaction.transactionType) === 1 || Number(transaction.transactionType) === 2) &&
      (await countCommitments(nonZeroCommitments)) === 0
    ) {
      ivks.forEach((key, i) => {
        // decompress the secrets first and then we will decryp t the secrets from this
        const decompressedSecrets = Secrets.decompressSecrets(transaction.compressedSecrets);
        try {
          const commitment = Secrets.decryptSecrets(
            decompressedSecrets,
            key,
            nonZeroCommitments[0],
          );
          if (Object.keys(commitment).length === 0)
            logger.info("This encrypted message isn't for this recipient");
          else {
            isTxDecrypt = true;
            storeCommitments.push(storeCommitment(commitment, nsks[i]));
            tempTransactionStore.push(
              saveTransaction({
                transactionHashL1,
                ...transaction,
              }),
            );
          }
        } catch (err) {
          logger.info(err);
          logger.info("This encrypted message isn't for this recipient");
        }
      });
    }
    await Promise.all(storeCommitments).catch(function (err) {
      logger.info(err);
    }); // control errors when storing commitments in order to ensure next Promise being executed

    await Promise.all(tempTransactionStore);
    // Update timestamps
    await updateTransactionTime(
      transactions.map(t => t.transactionHash),
      blockTimestamp,
    );
    return [
      markOnChain(nonZeroCommitments, block.blockNumberL2, data.blockNumber, data.transactionHash),
      markNullifiedOnChain(
        nonZeroNullifiers,
        block.blockNumberL2,
        data.blockNumber,
        data.transactionHash,
      ),
    ];
  });

  // await Promise.all(toStore);
  await Promise.all(dbUpdates);

  if (isTxDecrypt || (await countTransactionHashes(block.transactionHashes)) > 0) {
    await saveBlock({
      blockNumber: currentBlockCount,
      transactionHashL1,
      ...block,
    });
  }

  const updatedTimber = Timber.statelessUpdate(
    latestTree,
    blockCommitments,
    HASH_TYPE,
    TIMBER_HEIGHT,
  );
  await saveTree(data.blockNumber, block.blockNumberL2, updatedTimber);

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
