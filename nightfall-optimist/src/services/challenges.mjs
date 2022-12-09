import WebSocket from 'ws';
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
import { txsQueueChallenger } from '../utils/transactions-queue.mjs';
import { sendSignedTransaction } from './transaction-sign-send.mjs';

const web3 = Web3.connection();
const { TIMBER_HEIGHT } = config;
const { CHALLENGES_CONTRACT_NAME, ZERO } = constants;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const challengerKey = environment.CHALLENGER_KEY;
const { challengerEthAddress } = web3.eth.accounts.privateKeyToAccount(challengerKey);
let makeChallenges = process.env.IS_CHALLENGER === 'true';
let ws;

export function isMakeChallengesEnable() {
  return makeChallenges;
}

export function setChallengeWebSocketConnection(_ws) {
  ws = _ws;
}

/**
Function to indicate to a listening challenger that a rollback has been completed.
*/
export async function signalRollbackCompleted(data) {
  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending. If not wait until the challenger reconnects

  //challenger rollback
  let tryCount = 0;
  while (!ws || ws.readyState !== WebSocket.OPEN) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop
    logger.warn(
      `Websocket to challenger is closed for rollback complete. Waiting for challenger to reconnect`,
    );
    if (tryCount++ > 100) throw new Error(`Websocket to challenger has failed`);
  }
  logger.debug('Rollback completed');
  ws.send(JSON.stringify({ type: 'rollback', data }));
}

export function startMakingChallenges() {
  if (process.env.IS_CHALLENGER !== 'true')
    throw Error('Connot start challenger as this optimist never intend to be a challenger');
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
  const challengeContractAddress = challengeContractInstance.options.address;

  const commitToSign = await challengeContractInstance.methods
    .commitToChallenge(commitHash)
    .encodeABI();

  const signedTx = await createSignedTransaction(
    challengerKey,
    challengerEthAddress,
    challengeContractAddress,
    commitToSign,
  );

  const receipt = sendSignedTransaction(signedTx);
  //encode, sign and send transaction

  await saveCommit(commitHash, txDataToSign);

  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending commit. If not wait until the challenger reconnects
  let tryCount = 0;
  // while (!ws || ws.readyState !== WebSocket.OPEN) {
  //   await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop

  //   logger.warn(
  //     'Websocket to challenger is closed for commit.  Waiting for challenger to reconnect',
  //   );

  //   if (tryCount++ > 100) throw new Error(`Websocket to challenger has failed`);
  // }

  // ws.send(JSON.stringify({ type: 'commit', txDataToSign: commitToSign }));

  // logger.debug({
  //   msg: 'Raw transaction for committing to challenge has been sent to be signed and submitted',
  //   rawTransaction: commitToSign,
  // });
  return receipt;
}

export async function revealChallenge(txDataToSign, sender) {
  logger.debug('Revealing challenge');
  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending commit. If not wait until the challenger reconnects
  let tryCount = 0;
  while (!ws || ws.readyState !== WebSocket.OPEN) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop

    logger.warn(
      'Websocket to challenger is closed for reveal.  Waiting for challenger to reconnect',
    );

    if (tryCount++ > 100) {
      throw new Error(`Websocket to $challenger has failed`);
    }
  }
  ws.send(JSON.stringify({ type: 'challenge', txDataToSign, sender }));
}

export async function createChallenge(block, transactions, err) {
  let txDataToSign;
  const challengeContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  const salt = (await rand(32)).hex(32);
  switch (err.code) {
    // challenge incorrect leaf count
    case 0: {
      logger.debug(`Challenging incorrect leaf count for block ${JSON.stringify(block, null, 2)}`);
      const priorBlockL2 = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);

      // sign and submit transactions

      txDataToSign = await challengeContractInstance.methods
        .challengeLeafCountCorrect(
          Block.buildSolidityStruct(priorBlockL2), // the block immediately prior to this one
          Block.buildSolidityStruct(block),
          transactions.map(t => Transaction.buildSolidityStruct(t)),
          salt,
        )
        .encodeABI();
      break;
    }
    // Challenge wrong root
    //sign and send tx
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
      const uncompressedProof = transactions[transactionIndex].proof;
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
          uncompressedProof,
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
      const priorBlock = await getBlockByBlockNumberL2(Number(block.blockNumberL2) - 1);
      if (priorBlock === null)
        throw new Error(
          `Could not find prior block with block number ${Number(block.blockNumberL2) - 1}`,
        );

      const priorTree = await getTreeByBlockNumberL2(priorBlock.blockNumberL2);
      // We need to pad our frontier as we don't store them with the trailing zeroes.
      const frontierBeforeBlock = priorTree.frontier.concat(
        Array(TIMBER_HEIGHT - priorTree.frontier.length + 1).fill(ZERO),
      );
      // Create a challenge
      txDataToSign = await challengeContractInstance.methods
        .challengeNewFrontierCorrect(
          Block.buildSolidityStruct(priorBlock),
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
