// ignore unused exports default

import { ZkpKeys } from '@Nightfall/services/keys';
import { Commitment } from '@Nightfall/classes';
import { decrypt, packSecrets } from '@Nightfall/services/kem-dem';
import { generalise } from 'general-number';
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
import {
  getTreeByBlockNumberL2,
  saveTree,
  saveTransaction,
  saveBlock,
  setTransactionHashSiblingInfo,
  updateTransactionTime,
} from '../services/database';
import { edwardsDecompress } from '../../common-files/utils/curve-maths/curves';

const { TIMBER_HEIGHT, HASH_TYPE, TXHASH_TREE_HASH_TYPE } = global.config;
const { ZERO } = global.nightfallConstants;

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data, zkpPrivateKeys, nullifierKeys) {
  console.log(`Received Block Proposed event: ${JSON.stringify(data)}`);
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { transactions, block, blockTimestamp } = data;
  const latestTree = await getTreeByBlockNumberL2(block.blockNumberL2 - 1);
  const blockCommitments = transactions
    .map(t => t.commitments.filter(c => c !== ZERO))
    .flat(Infinity);
  let isTxDecrypt = false;

  const dbUpdates = transactions.map(async transaction => {
    // filter out non zero commitments and nullifiers
    const nonZeroCommitments = transaction.commitments.filter(n => n !== ZERO);
    const nonZeroNullifiers = transaction.nullifiers.filter(n => n !== ZERO);

    const countOfNonZeroCommitments = await countCommitments([nonZeroCommitments[0]]);

    const storeCommitments = [];
    const tempTransactionStore = [];
    if (Number(transaction.transactionType) === 1 && countOfNonZeroCommitments === 0) {
      zkpPrivateKeys.forEach((key, i) => {
        // decompress the secrets first and then we will decryp t the secrets from this
        const { zkpPublicKey } = ZkpKeys.calculateZkpPublicKey(generalise(key));
        try {
          const cipherTexts = [
            transaction.ercAddress,
            transaction.tokenId,
            ...transaction.compressedSecrets,
          ];
          const [packedErc, unpackedTokenID, ...rest] = decrypt(
            generalise(key),
            generalise(edwardsDecompress(transaction.recipientAddress)),
            generalise(cipherTexts),
          );
          const [erc, tokenId] = packSecrets(
            generalise(packedErc),
            generalise(unpackedTokenID),
            2,
            0,
          );
          const plainTexts = generalise([erc, tokenId, ...rest]);
          const commitment = new Commitment({
            zkpPublicKey,
            ercAddress: plainTexts[0].bigInt,
            tokenId: plainTexts[1].bigInt,
            value: plainTexts[2].bigInt,
            salt: plainTexts[3].bigInt,
          });
          if (commitment.hash.hex(32) === nonZeroCommitments[0]) {
            isTxDecrypt = true;
            logger.info('Successfully decrypted commitment for this recipient');
            storeCommitments.push(storeCommitment(commitment, nullifierKeys[i]));
            tempTransactionStore.push(
              saveTransaction({
                transactionHashL1,
                ...transaction,
              }),
            );
          }
        } catch (err) {
          // This error will be caught regularly if the commitment isn't for us
          // We dont print anything in order not to pollute the logs
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
  if ((await countWithdrawTransactionHashes(block.transactionHashes)) > 0) {
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
        if (await isTransactionHashWithdraw(transactionHash)) {
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
