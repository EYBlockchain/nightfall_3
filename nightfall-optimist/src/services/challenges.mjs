/* eslint-disable no-unused-vars */
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Web3 from '@polygon-nightfall/common-files/utils/web3.mjs';
import { getContractInstance } from '@polygon-nightfall/common-files/utils/contract.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { rand } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import {
  saveCommit,
  getBlockByBlockNumberL2,
  getTreeByBlockNumberL2,
  getTransactionHashSiblingInfo,
} from './database.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';

const { TIMBER_HEIGHT } = config;
const { CHALLENGES_CONTRACT_NAME, ZERO } = constants;

let makeChallenges = process.env.IS_CHALLENGER === 'true';
export function isMakeChallengesEnable() {
  return makeChallenges;
}

export function startMakingChallenges() {
  if (process.env.IS_CHALLENGER !== 'true') {
    throw new Error('Cannot start challenger as this optimist never intend to be a challenger');
  }
  logger.info(`Challenges ON`);
  makeChallenges = true;
}

export function stopMakingChallenges() {
  logger.info(`Challenges OFF`);
  makeChallenges = false;
}

export async function commitToChallenge(txDataToSign) {
  if (!makeChallenges) {
    logger.debug('makeChallenges is off, no challenge commitment was sent');
    return;
  }
  const web3 = Web3.connection();
  const commitHash = web3.utils.soliditySha3({ t: 'bytes', v: txDataToSign });
  const challengeContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  const commitToSign = await challengeContractInstance.methods
    .commitToChallenge(commitHash)
    .encodeABI();

  await saveCommit(commitHash, txDataToSign);

  // ws.send(JSON.stringify({ type: 'commit', txDataToSign: commitToSign }));
  // TODO sign and send commitToSign
}

export async function revealChallenge(txDataToSign, sender) {
  logger.debug('Revealing challenge');

  // ws.send(JSON.stringify({ type: 'challenge', txDataToSign, sender }));
  // TODO sign and send txDataToSign
}

export async function createChallenge(block, transactions, err) {
  let txDataToSign;
  const challengeContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  const salt = (await rand(32)).hex(32);
  logger.debug({ msg: `Challenging the L2 block with ${block.blockNumberL2} block number` });
  switch (err.code) {
    // challenge incorrect leaf count
    case 0: {
      logger.debug(`Challenging incorrect leaf count for block ${JSON.stringify(block, null, 2)}`);
      let priorBlockL2Solidity = {
        packedInfo: ZERO,
        root: ZERO,
        previousBlockHash: ZERO,
        frontierHash: ZERO,
        transactionHashesRoot: ZERO,
      };

      if (block.blockNumberL2 !== 0) {
        const priorBlockL2 = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);
        priorBlockL2Solidity = Block.buildSolidityStruct(priorBlockL2); // the block immediately prior to this one
      }

      txDataToSign = await challengeContractInstance.methods
        .challengeLeafCountCorrect(
          priorBlockL2Solidity, // the block immediately prior to this one
          Block.buildSolidityStruct(block),
          transactions.map(t => Transaction.buildSolidityStruct(t)),
          salt,
        )
        .encodeABI();
      break;
    }
    // Challenge wrong root
    case 1: {
      logger.debug(`Challenging incorrect root`);

      const tree = await getTreeByBlockNumberL2(block.blockNumberL2);
      // We need to pad our frontier as we don't store them with the trailing zeroes.
      const frontierAfterBlock = tree.frontier.concat(
        Array(TIMBER_HEIGHT - tree.frontier.length + 1).fill(ZERO),
      );
      // Create a challenge
      txDataToSign = await challengeContractInstance.methods
        .challengeNewRootCorrect(frontierAfterBlock, Block.buildSolidityStruct(block), salt)
        .encodeABI();
      break;
    }
    // challenge duplicate commitment
    case 2: {
      logger.debug({
        msg: 'Challenging duplicate commitment for block',
        block,
      });
      logger.debug({
        msg: 'Challenging duplicate commitment for block transactions',
        transactions,
      });

      const {
        block1,
        transaction1,
        transaction1Index,
        siblingPath1,
        duplicateCommitment1Index,
        block2,
        transaction2,
        transaction2Index,
        siblingPath2,
        duplicateCommitment2Index,
      } = err.metadata;
      txDataToSign = await challengeContractInstance.methods
        .challengeCommitment(
          {
            blockL2: Block.buildSolidityStruct(block1),
            transaction: Transaction.buildSolidityStruct(transaction1),
            transactionIndex: transaction1Index,
            transactionSiblingPath: siblingPath1,
          },
          {
            blockL2: Block.buildSolidityStruct(block2),
            transaction: Transaction.buildSolidityStruct(transaction2),
            transactionIndex: transaction2Index,
            transactionSiblingPath: siblingPath2,
          },
          duplicateCommitment1Index,
          duplicateCommitment2Index,
          salt,
        )
        .encodeABI();
      break;
    }
    // challenge duplicate nullifier
    case 3: {
      logger.debug({
        msg: 'Challenging duplicate nullifier for block',
        block,
      });
      logger.debug({
        msg: 'Challenging duplicate nullifier for block transactions',
        transactions,
      });

      const {
        block1,
        transaction1,
        transaction1Index,
        siblingPath1,
        duplicateNullifier1Index,
        block2,
        transaction2,
        transaction2Index,
        siblingPath2,
        duplicateNullifier2Index,
      } = err.metadata;
      txDataToSign = await challengeContractInstance.methods
        .challengeNullifier(
          {
            blockL2: Block.buildSolidityStruct(block1),
            transaction: Transaction.buildSolidityStruct(transaction1),
            transactionIndex: transaction1Index,
            transactionSiblingPath: siblingPath1,
          },
          {
            blockL2: Block.buildSolidityStruct(block2),
            transaction: Transaction.buildSolidityStruct(transaction2),
            transactionIndex: transaction2Index,
            transactionSiblingPath: siblingPath2,
          },
          duplicateNullifier1Index,
          duplicateNullifier2Index,
          salt,
        )
        .encodeABI();
      break;
    }
    // proof does not verify
    case 4: {
      logger.debug({
        msg: 'Challenging proof verification for block',
        block,
      });
      logger.debug({
        msg: 'Challenging proof verification for block transactions',
        transactions,
      });

      const { transactionHashIndex: transactionIndex } = err.metadata;
      // Create a challenge
      const historicRoots = await Promise.all(
        transactions[transactionIndex].historicRootBlockNumberL2.map(async (b, i) => {
          if (transactions[transactionIndex].nullifiers[i] === 0) {
            return {};
          }
          const historicBlock = await getBlockByBlockNumberL2(b);
          return Block.buildSolidityStruct(historicBlock);
        }),
      );

      let transactionSiblingPath = (
        await getTransactionHashSiblingInfo(transactions[transactionIndex].transactionHash)
      ).transactionHashSiblingPath;

      // case when block.build never was called
      // may be this optimist never ran as proposer
      // or more likely since this tx is bad tx from a bad proposer.
      // prposer hosted in this optimist never build any block with this bad tx in it
      if (!transactionSiblingPath) {
        await Block.calcTransactionHashesRoot(transactions);
        transactionSiblingPath = (
          await getTransactionHashSiblingInfo(transactions[transactionIndex].transactionHash)
        ).transactionHashSiblingPath;
      }

      txDataToSign = await challengeContractInstance.methods
        .challengeProofVerification(
          {
            blockL2: Block.buildSolidityStruct(block),
            transaction: Transaction.buildSolidityStruct(transactions[transactionIndex]),
            transactionIndex,
            transactionSiblingPath,
          },
          historicRoots,
          salt,
        )
        .encodeABI();
      break;
    }
    // historic root block number not correct
    case 5: {
      const { transactionHashIndex: transactionIndex } = err.metadata;
      let transactionSiblingPath = (
        await getTransactionHashSiblingInfo(transactions[transactionIndex].transactionHash)
      ).transactionHashSiblingPath;

      // case when block.build never was called
      // may be this optimist never ran as proposer
      // or more likely since this tx is bad tx from a bad proposer.
      // prposer hosted in this optimist never build any block with this bad tx in it
      if (!transactionSiblingPath) {
        await Block.calcTransactionHashesRoot(transactions);
        transactionSiblingPath = (
          await getTransactionHashSiblingInfo(transactions[transactionIndex].transactionHash)
        ).transactionHashSiblingPath;
      }

      txDataToSign = await challengeContractInstance.methods
        .challengeHistoricRootBlockNumber({
          blockL2: Block.buildSolidityStruct(block),
          transaction: Transaction.buildSolidityStruct(transactions[transactionIndex]),
          transactionIndex,
          transactionSiblingPath,
        })
        .encodeABI();
      break;
    }
    // frontier is incorrect
    case 6: {
      logger.debug('Challenging incorrect frontier');
      // Getting prior block for the current block
      let priorBlockL2Solidity = {
        packedInfo: ZERO,
        root: ZERO,
        previousBlockHash: ZERO,
        frontierHash: ZERO,
        transactionHashesRoot: ZERO,
      };

      let frontierBeforeBlock = Array(TIMBER_HEIGHT + 1).fill(ZERO);
      if (block.blockNumberL2 !== 0) {
        const priorBlockL2 = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);
        priorBlockL2Solidity = Block.buildSolidityStruct(priorBlockL2); // the block immediately prior to this one
        const priorTree = await getTreeByBlockNumberL2(priorBlockL2.blockNumberL2);
        // We need to pad our frontier as we don't store them with the trailing zeroes.
        frontierBeforeBlock = priorTree.frontier.concat(
          Array(TIMBER_HEIGHT - priorTree.frontier.length + 1).fill(ZERO),
        );
      }

      // Create a challenge
      txDataToSign = await challengeContractInstance.methods
        .challengeNewFrontierCorrect(
          priorBlockL2Solidity,
          frontierBeforeBlock,
          Block.buildSolidityStruct(block),
          transactions.map(t => Transaction.buildSolidityStruct(t)),
          salt,
        )
        .encodeABI();
      break;
    }
    default:
    // code block
  }
  // now we need to commit to this challenge. When we have, this fact will be
  // picked up by the challenge-commit event-handler and a reveal will be sent
  // to intiate the challenge transaction (after checking we haven't been
  // front-run)
  logger.info("Faulty block detected. Don't submit new blocks until the faulty blocks are removed");
  return txDataToSign;
}
