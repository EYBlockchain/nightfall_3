import config from 'config';
import logger from '../utils/logger.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import {
  getBlockByBlockHash,
  getTransactionByTransactionHash,
  getBlockByTransactionHash,
} from './database.mjs';
import { getTreeHistory } from '../utils/timber.mjs';

const { SHIELD_CONTRACT_NAME } = config;

let ws;

export function setChallengeWebSocketConnection(_ws) {
  ws = _ws;
}

function submitChallenge(txDataToSign) {
  logger.debug(
    `raw challenge transaction has been sent to be signed and submitted ${JSON.stringify(
      txDataToSign,
      null,
      2,
    )}`,
  );
  ws.send(JSON.stringify({ type: 'challenge', txDataToSign }));
}

async function getTransactionsBlock(transactions, block, length) {
  if (length === block.transactionHashes.length) {
    return transactions;
  }
  transactions.push(await getTransactionByTransactionHash(block.transactionHashes[length]));
  return getTransactionsBlock(transactions, block, length + 1);
}

export default async function createChallenge(block, transactions, err) {
  let txDataToSign;
  if (process.env.IS_CHALLENGER === 'true') {
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    switch (err.code) {
      // Challenge wrong root
      case 0: {
        // Getting prior block hash for the current block
        const { previousHash } = await shieldContractInstance.methods
          .blockHashes(block.blockHash)
          .call();

        // Retrieve prior block from its block hash
        const priorBlock = await getBlockByBlockHash(previousHash);

        // Retrieve last transaction from prior block using its transaction hash.
        // Note that not all transactions in a block will have commitments. Loop until one is found
        let priorBlockTransactions = [];
        priorBlockTransactions = await getTransactionsBlock(priorBlockTransactions, priorBlock, 0);
        const priorBlockCommitmentsCount = priorBlockTransactions.reduce(
          (acc, priorBlockTransaction) => {
            return acc + priorBlockTransaction.commitments.length;
          },
          0,
        );

        const priorBlockHistory = await getTreeHistory(priorBlock.root);

        // Create a challenge
        txDataToSign = await shieldContractInstance.methods
          .challengeNewRootCorrect(
            priorBlock,
            priorBlockTransactions,
            priorBlockHistory.frontier,
            block,
            transactions,
            priorBlockHistory.leafIndex + priorBlockCommitmentsCount, // priorBlockHistory.leafIndex + number of commitments  in prior block
          )
          .encodeABI();
        break;
      }
      // Challenge Duplicate Transaction
      case 1: {
        const transactionIndex1 = err.metadata.transactionHashIndex;

        // Get the block that contains the duplicate of the transaction
        const block2 = await getBlockByTransactionHash(
          block.transactionHashes[transactionIndex1],
          true,
        );
        // Find the index of the duplication transaction in this block
        const transactionIndex2 = block2.transactionHashes.findIndex(
          transactionHash => transactionHash === block.transactionHashes[transactionIndex1],
        );

        // Create a challenge
        txDataToSign = await shieldContractInstance.methods
          .challengeNoDuplicateTransaction(
            block,
            block2,
            transactionIndex1, // index of duplicate transaction in block
            transactionIndex2,
          )
          .encodeABI();
        break;
      }
      // invalid transaction
      case 2: {
        const { transaction, transactionHashIndex: transactionIndex } = err.metadata;
        // Create a challenge
        txDataToSign = await shieldContractInstance.methods
          .challengeTransactionType(block, transaction, transactionIndex)
          .encodeABI();
        break;
      }
      default:
      // code block
    }
    logger.debug('returning raw transaction');
    logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    submitChallenge(txDataToSign);
  } else {
    // only proposer not a challenger
    logger.info(
      "Faulty block detected. Don't submit new blocks until the faulty blocks are removed",
    );
  }
}
