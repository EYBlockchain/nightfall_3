import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Timber from 'common-files/classes/timber.mjs';
import {
  markNullifiedOnChain,
  markOnChain,
  storeCommitment,
  countCommitments,
  setSiblingInfo,
} from '../services/commitment-storage.mjs';
import getProposeBlockCalldata from '../services/process-calldata.mjs';
import Secrets from '../classes/secrets.mjs';
import { ivks, nsks } from '../services/keys.mjs';
import { getLatestTree, saveTree, saveTransaction, saveBlock } from '../services/database.mjs';

const { ZERO } = config;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { transactions, block } = await getProposeBlockCalldata(data);
  logger.info(
    `Received Block Proposed event with layer 2 block number ${block.blockNumberL2} and tx hash ${transactionHashL1}`,
  );
  const latestTree = await getLatestTree();
  const blockCommitments = transactions.map(t => t.commitments.filter(c => c !== ZERO)).flat();

  if ((await countCommitments(blockCommitments)) > 0) {
    await saveBlock({ blockNumber: currentBlockCount, transactionHashL1, ...block });
    logger.debug(`Saved L2 block ${block.blockNumberL2}, with tx hash ${transactionHashL1}`);
    await Promise.all(transactions.map(t => saveTransaction({ transactionHashL1, ...t })));
  }

  const dbUpdates = transactions.map(async transaction => {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transaction.commitments.flat().filter(n => n !== ZERO);
    const nonZeroNullifiers = transaction.nullifiers.flat().filter(n => n !== ZERO);
    const storeCommitments = [];
    if (
      (transaction.transactionType === '1' || transaction.transactionType === '2') &&
      (await countCommitments(nonZeroCommitments)) === 0
    ) {
      let keysTried = 1;
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
            logger.info(
              `This encrypted message isn't for this recipient, keys tried = ${keysTried++}`,
            );
          else {
            // console.log('PUSHED', commitment, 'nsks', nsks[i]);
            storeCommitments.push(storeCommitment(commitment, nsks[i]));
          }
        } catch (err) {
          logger.info(err);
          logger.info(
            `*This encrypted message isn't for this recipient, keys tried = ${keysTried++}`,
          );
        }
      });
    }
    await Promise.all(storeCommitments);
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
  const updatedTimber = Timber.statelessUpdate(latestTree, blockCommitments);
  await saveTree(transactionHashL1, block.blockNumberL2, updatedTimber);
  logger.debug(`Saved tree for L2 block ${block.blockNumberL2}`);
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
