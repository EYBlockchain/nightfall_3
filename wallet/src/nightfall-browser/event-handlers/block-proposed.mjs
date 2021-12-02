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
  logger.info(`Received Block Proposed event`);
  // ivk will be used to decrypt secrets whilst nsk will be used to calculate nullifiers for commitments and store them
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { transactions, block } = await getProposeBlockCalldata(data);
  const latestTree = await getLatestTree();
  const blockCommitments = transactions.map(t => t.commitments.filter(c => c !== ZERO)).flat();

  if ((await countCommitments(blockCommitments)) > 0) {
    await saveBlock({ blockNumber: currentBlockCount, transactionHashL1, ...block });
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
      ivks.forEach((key, i) => {
        // decompress the secrets first and then we will decryp t the secrets from this
        const decompressedSecrets = Secrets.decompressSecrets(transaction.compressedSecrets);
        try {
          const commitment = Secrets.decryptSecrets(
            decompressedSecrets,
            key,
            nonZeroCommitments[0],
          );
          if (commitment === {}) logger.info("This encrypted message isn't for this recipient");
          else {
            storeCommitments.push(storeCommitment(commitment, nsks[i]));
          }
        } catch (err) {
          logger.info(err);
          logger.info("This encrypted message isn't for this recipient");
        }
      });
    }
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
