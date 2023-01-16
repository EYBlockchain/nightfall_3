/* eslint-disable no-await-in-loop */

/**
 * This module does all of the heaving lifting for a Proposer: It assembles blocks
 * from posted transactions and proposes these blocks.
 */
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { waitForTimeout } from '@polygon-nightfall/common-files/utils/utils.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { removeTransactionsFromMemPool, getMempoolTxsSortedByFee } from './database.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';
import { createSignedTransaction, sendSignedTransaction } from './transaction-sign-send.mjs';
import { proposerTxsQueue } from '../utils/transactions-queue.mjs';

const { MAX_BLOCK_SIZE, MINIMUM_TRANSACTION_SLOTS, PROPOSER_MAX_BLOCK_PERIOD_MILIS } = config;
const { STATE_CONTRACT_NAME } = constants;

let makeNow = false;
let lastBlockTimestamp = new Date().getTime();
let blockPeriodMs = PROPOSER_MAX_BLOCK_PERIOD_MILIS;

export function setMakeNow(_makeNow = true) {
  makeNow = _makeNow;
}

export function setBlockPeriodMs(timeMs) {
  blockPeriodMs = timeMs;
}

async function makeBlock(proposer, transactions) {
  logger.debug('Block Assembler - about to make a new block');
  // then we make new block objects until we run out of unprocessed transactions
  return Block.build({ proposer, transactions });
}

/**
 * This function will make a block iff I am the proposer and there are enough
 * transactions in the database to assemble a block from. It loops until told to
 * stop making blocks. It is called from the 'main()' routine to start it, and
 * should not be called from anywhere else because we only want one instance ever
 */
export async function conditionalMakeBlock(args) {
  const { proposer, proposerEthAddress, proposerEthPrivateKey } = args;

  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
  const stateContractAddress = stateContractInstance.options.address;

  /*
    if we are the current proposer, and there are enough transactions waiting
    to be processed, we can assemble a block and create a proposal
    transaction. If not, we must wait until either we have enough (hooray)
    or we're no-longer the proposer (boo).
   */

  logger.info(`I am the current proposer: ${proposer.isMe}`);

  if (proposer.isMe) {
    logger.info({
      msg: 'The maximum size of the block is',
      blockSize: MAX_BLOCK_SIZE,
      blockPeriodMs,
      makeNow,
    });

    // Get all the mempool transactions sorted by fee
    const mempoolTransactions = await getMempoolTxsSortedByFee();

    // Map each mempool transaction to their byte size
    const mempoolTransactionSizes = mempoolTransactions.map(tx => {
      const txSlots =
        MINIMUM_TRANSACTION_SLOTS +
        tx.nullifiers.length +
        Math.ceil(tx.historicRootBlockNumberL2.length / 4) +
        tx.commitments.length;

      return txSlots * 32;
    });

    // Calculate the total number of bytes that are in the mempool
    const totalBytes = mempoolTransactionSizes.reduce((acc, curr) => acc + curr, 0);
    const currentTime = new Date().getTime();

    logger.info({
      msg: 'In the mempool there are the following number of transactions',
      numberTransactions: mempoolTransactions.length,
      totalBytes,
    });

    const transactionBatches = [];
    if (totalBytes > 0) {
      let bytesSum = 0;
      for (let i = 0; i < mempoolTransactionSizes.length; ++i) {
        if (bytesSum + mempoolTransactionSizes[i] > MAX_BLOCK_SIZE) {
          bytesSum = mempoolTransactionSizes[i];
          transactionBatches.push(i);
        } else {
          bytesSum += mempoolTransactionSizes[i];
        }
      }

      if (
        transactionBatches.length === 0 &&
        (makeNow || (blockPeriodMs > 0 && currentTime - lastBlockTimestamp >= blockPeriodMs))
      ) {
        transactionBatches.push(mempoolTransactionSizes.length);
      }
    }

    logger.info({
      msg: 'The proposer can create the following number of blocks',
      transactionBatches: transactionBatches.length,
    });

    if (transactionBatches.length >= 1) {
      lastBlockTimestamp = currentTime;
      // TODO set an upper limit to numberOfProposableL2Blocks because a proposer
      /*
        might not be able to submit a large number of blocks before the next proposer becomes
        the current proposer. In this case, this proposer's transactions will still be mined but
        the transactions will fail and proposer will lose gas fees
      */
      logger.debug({
        msg: 'Block Assembler will create blocks at once',
        numberBlocks: transactionBatches.length,
      });

      for (let i = 0; i < transactionBatches.length; i++) {
        // we retrieve un-processed transactions from our local database, relying on
        // the transaction service to keep the database current

        const start = i === 0 ? 0 : transactionBatches[i - 1];
        const end = transactionBatches[i];

        const transactions = mempoolTransactions.slice(start, end);

        makeNow = false; // reset the makeNow so we only make one block with a short number of transactions

        const block = await makeBlock(proposer.address, transactions);

        const blockSize = mempoolTransactionSizes
          .slice(start, end)
          .reduce((acc, curr) => acc + curr, 0);

        logger.info({
          msg: 'Block Assembler - New Block created',
          block,
          blockSize,
        });

        // Propose this block to the State contract
        const txDataToSign = await stateContractInstance.methods
          .proposeBlock(
            Block.buildSolidityStruct(block),
            transactions.map(t => Transaction.buildSolidityStruct(t)),
          )
          .encodeABI();

        // Sign tx
        const blockStake = await stateContractInstance.methods.getBlockStake().call();
        const signedTx = await createSignedTransaction(
          proposerEthPrivateKey,
          proposerEthAddress,
          stateContractAddress,
          txDataToSign,
          blockStake,
        );

        // Submit tx and update db if tx is successful
        proposerTxsQueue.push(async () => {
          try {
            const receipt = await sendSignedTransaction(signedTx);
            logger.debug({ msg: 'Block proposed', receipt });

            await removeTransactionsFromMemPool(block.transactionHashes);
            logger.debug('Transactions updated in db');
          } catch (err) {
            logger.error({
              msg: 'Something went wrong',
              err,
            });
          }
        });
      }
    }
  }
  // Let's slow down here so we don't slam the database.
  await waitForTimeout(3000);
}
