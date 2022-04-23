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
} from '../services/commitment-storage';
// import getProposeBlockCalldata from '../services/process-calldata';
import Secrets from '../classes/secrets';
// import { ivks, nsks } from '../services/keys';
import { getTreeByBlockNumberL2, saveTree, saveTransaction, saveBlock } from '../services/database';

const { ZERO, ZERO31 } = global.config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, ivks, nsks) {
  console.log(`Received Block Proposed event: ${JSON.stringify(data)}`);
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  // const { transactions, block } = await getProposeBlockCalldata(data);
  const { transactions, block } = data;
  const latestTree = await getTreeByBlockNumberL2(block.blockNumberL2 - 1);
  const blockCommitments = transactions.map(t => t.commitments.filter(c => c !== ZERO)).flat();

  let tempBlockSaved = false;
  if ((await countTransactionHashes(block.transactionHashes)) > 0) {
    await saveBlock({ blockNumber: currentBlockCount, transactionHashL1, ...block });
    await Promise.all(transactions.map(t => saveTransaction({ transactionHashL1, ...t })));
    tempBlockSaved = true;
  }

  const dbUpdates = transactions.map(async transaction => {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
    const nonZeroNullifiers = transaction.nullifiers.flat().filter(n => n !== ZERO31);
    const storeCommitments = [];
    const tempTransactionStore = [];
    if (
      (transaction.transactionType === '1' || transaction.transactionType === '2') &&
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
            storeCommitments.push(storeCommitment(commitment, nsks[i]));
            tempTransactionStore.push(saveTransaction({ transactionHashL1, ...transaction }));
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
    if (!tempBlockSaved) await Promise.all(tempTransactionStore);
    return [
      Promise.all(storeCommitments),
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
  const updatedTimber = Timber.statelessUpdate(latestTree, blockCommitments);
  await saveTree(data.blockNumber, block.blockNumberL2, updatedTimber);

  await Promise.all(
    // eslint-disable-next-line consistent-return
    blockCommitments.map(async (c, i) => {
      const count = await countCommitments([c]);
      if (count > 0) {
        const siblingPath = Timber.statelessSiblingPath(latestTree, blockCommitments, i);
        return setSiblingInfo(c, siblingPath, latestTree.leafCount + i, updatedTimber.root);
      }
    }),
  );
}

export default blockProposedEventHandler;
