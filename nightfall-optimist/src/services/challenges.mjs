import WebSocket from 'ws';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Web3 from 'common-files/utils/web3.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';
import { rand } from 'common-files/utils/crypto/crypto-random.mjs';
import {
  getBlockByBlockHash,
  getBlockByTransactionHash,
  retrieveMinedNullifiers,
  saveCommit,
  getTransactionsByTransactionHashes,
  getBlockByBlockNumberL2,
  getTreeByRoot,
} from './database.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';

const { TIMBER_HEIGHT } = config;
const { CHALLENGES_CONTRACT_NAME, ZERO } = constants;

let makeChallenges = process.env.IS_CHALLENGER === 'true';
let ws;

export function setChallengeWebSocketConnection(_ws) {
  ws = _ws;
}

export function startMakingChallenges() {
  logger.info(`Challenges ON`);
  makeChallenges = true;
}
export function stopMakingChallenges() {
  logger.info(`Challenges OFF`);
  makeChallenges = false;
}

async function commitToChallenge(txDataToSign) {
  const web3 = Web3.connection();
  const commitHash = web3.utils.soliditySha3({ t: 'bytes', v: txDataToSign });
  const challengeContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
  const commitToSign = await challengeContractInstance.methods
    .commitToChallenge(commitHash)
    .encodeABI();
  logger.debug(
    `raw transaction for committing to challenge has been sent to be signed and submitted ${JSON.stringify(
      commitToSign,
      null,
      2,
    )}`,
  );
  await saveCommit(commitHash, txDataToSign);
  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending commit. If not wait until the challenger reconnects
  let tryCount = 0;
  while (!ws || ws.readyState !== WebSocket.OPEN) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop
    logger.warn(
      `Websocket to challenger is closed for commit.  Waiting for challenger to reconnect`,
    );
    if (tryCount++ > 100) throw new Error(`Websocket to challenger has failed`);
  }
  ws.send(JSON.stringify({ type: 'commit', txDataToSign: commitToSign }));
}

export async function revealChallenge(txDataToSign) {
  logger.debug('raw challenge transaction has been sent to be signed and submitted');
  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending commit. If not wait until the challenger reconnects
  let tryCount = 0;
  while (!ws || ws.readyState !== WebSocket.OPEN) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop
    logger.warn(
      `Websocket to challenger is closed for reveal.  Waiting for challenger to reconnect`,
    );
    if (tryCount++ > 100) throw new Error(`Websocket to $challenger has failed`);
  }
  ws.send(JSON.stringify({ type: 'challenge', txDataToSign }));
}

export async function createChallenge(block, transactions, err) {
  let txDataToSign;
  if (makeChallenges) {
    const challengeContractInstance = await getContractInstance(CHALLENGES_CONTRACT_NAME);
    const salt = (await rand(32)).hex(32);
    switch (err.code) {
      // Challenge wrong root
      case 0: {
        logger.debug('Challenging incorrect root');
        // Getting prior block for the current block
        const priorBlock = await getBlockByBlockNumberL2(Number(block.blockNumberL2) - 1);
        if (priorBlock === null)
          throw new Error(
            `Could not find prior block with block number ${Number(block.blockNumberL2) - 1}`,
          );
        // Retrieve last transaction from prior block using its transaction hash.
        // Note that not all transactions in a block will have commitments. Loop until one is found
        const priorBlockTransactions = await getTransactionsByTransactionHashes(
          priorBlock.transactionHashes,
        );

        // We also need to grab the block 2 before the challenged block as it contains the frontier to
        // calculate the root of the prior block.
        const priorPriorBlock = await getBlockByBlockNumberL2(Number(block.blockNumberL2) - 2);
        if (priorPriorBlock === null) priorPriorBlock.root = ZERO;

        const priorPriorTree = await getTreeByRoot(priorPriorBlock.root);
        // We need to pad our frontier as we don't store them with the trailing zeroes.
        const frontierToValidatePreviousBlock = priorPriorTree.frontier.concat(
          Array(TIMBER_HEIGHT - priorPriorTree.frontier.length + 1).fill(ZERO),
        );
        // Create a challenge
        txDataToSign = await challengeContractInstance.methods
          .challengeNewRootCorrect(
            Block.buildSolidityStruct(priorBlock),
            priorBlockTransactions.map(t => Transaction.buildSolidityStruct(t)),
            frontierToValidatePreviousBlock,
            Block.buildSolidityStruct(block),
            transactions.map(t => Transaction.buildSolidityStruct(t)),
            salt,
          )
          .encodeABI();
        break;
      }
      // Challenge Duplicate Transaction
      case 1: {
        const { transactionHashIndex: transactionIndex1, transactionHash: transactionHash1 } =
          err.metadata;

        // Get the block that contains the duplicate of the transaction
        const [block2] = (await getBlockByTransactionHash(transactionHash1)).filter(
          b => b.blockHash !== block.blockHash,
        );
        const transactions2 = await getTransactionsByTransactionHashes(block2.transactionHashes);
        const transactionIndex2 = transactions2
          .map(t => t.transactionHash)
          .indexOf(transactionHash1);
        if (transactionIndex2 === -1) throw new Error('Could not find duplicate transaction');
        // Create a challenge. Don't forget to remove properties that don't get
        // sent to the blockchain
        txDataToSign = await challengeContractInstance.methods
          .challengeNoDuplicateTransaction(
            Block.buildSolidityStruct(block),
            Block.buildSolidityStruct(block2),
            transactions.map(t => Transaction.buildSolidityStruct(t)),
            transactions2.map(t => Transaction.buildSolidityStruct(t)),
            transactionIndex1, // index of duplicate transaction in block
            transactionIndex2,
            salt,
          )
          .encodeABI();
        break;
      }
      // historic root is incorrect
      case 3: {
        const { transactionHashIndex: transactionIndex } = err.metadata;
        // Create a challenge
        txDataToSign = await challengeContractInstance.methods
          .challengeHistoricRoot(
            Block.buildSolidityStruct(block),
            transactions.map(t => Transaction.buildSolidityStruct(t)),
            transactionIndex,
            salt,
          )
          .encodeABI();
        break;
      }
      // proof does not verify
      case 4: {
        const { transactionHashIndex: transactionIndex } = err.metadata;
        // Create a challenge
        const uncompressedProof = transactions[transactionIndex].proof;
        const [historicInput1, historicInput2, historicInput3, historicInput4] = await Promise.all(
          transactions[transactionIndex].historicRootBlockNumberL2.map(async (b, i) => {
            if (transactions[transactionIndex].nullifiers[i] === 0) {
              return {
                historicBlock: {},
                historicTxs: [],
              };
            }
            const historicBlock = await getBlockByBlockNumberL2(b);
            const historicTxs = await getTransactionsByTransactionHashes(block.transactionHashes);
            return {
              historicBlock: Block.buildSolidityStruct(historicBlock),
              historicTxs,
            };
          }),
        );

        txDataToSign = await challengeContractInstance.methods
          .challengeProofVerification(
            Block.buildSolidityStruct(block),
            transactions.map(t => Transaction.buildSolidityStruct(t)),
            transactionIndex,
            [
              historicInput1.historicBlock,
              historicInput2.historicBlock,
              historicInput3.historicBlock,
              historicInput4.historicBlock,
            ],
            [
              historicInput1.historicTxs.map(t => Transaction.buildSolidityStruct(t)),
              historicInput2.historicTxs.map(t => Transaction.buildSolidityStruct(t)),
              historicInput3.historicTxs.map(t => Transaction.buildSolidityStruct(t)),
              historicInput4.historicTxs.map(t => Transaction.buildSolidityStruct(t)),
            ],
            uncompressedProof,
            salt,
          )
          .encodeABI();
        break;
      }
      // Challenge Duplicate Nullfier
      case 6: {
        const storedMinedNullifiers = await retrieveMinedNullifiers(); // List of Nullifiers stored by blockProposer
        const blockNullifiers = transactions.map(tNull => tNull.nullifiers).flat(Infinity); // List of Nullifiers in block
        const alreadyMinedNullifiers = storedMinedNullifiers.filter(sNull =>
          blockNullifiers.includes(sNull.hash),
        );
        if (alreadyMinedNullifiers.length > 0) {
          const n = alreadyMinedNullifiers[0]; // We can only slash this block no matter which nullifier we pick anyways.
          const oldBlock = await getBlockByBlockHash(n.blockHash);
          const oldBlockTransactions = await getTransactionsByTransactionHashes(
            oldBlock.transactionHashes,
          );

          const [oldTxIdx, oldNullifierIdx] = oldBlockTransactions
            .map((txs, txIndex) => {
              const txIndexNullifier = txs.nullifiers.findIndex(oldN => oldN.toString() === n.hash);
              return [txIndex, txIndexNullifier];
            })
            .filter(oldIdxs => oldIdxs[1] >= 0)
            .flat(Infinity);

          const [currentTxIdx, currentNullifierIdx] = transactions
            .map((txs, txIndex) => {
              const txIndexNullifier = txs.nullifiers.findIndex(
                currN => currN.toString() === n.hash,
              );

              return [txIndex, txIndexNullifier];
            })
            .filter(oldIdxs => oldIdxs[1] >= 0)
            .flat(Infinity);
          txDataToSign = await challengeContractInstance.methods
            .challengeNullifier(
              Block.buildSolidityStruct(block),
              transactions.map(t => Transaction.buildSolidityStruct(t)),
              currentTxIdx,
              currentNullifierIdx,
              Block.buildSolidityStruct(oldBlock),
              oldBlockTransactions.map(t => Transaction.buildSolidityStruct(t)),
              oldTxIdx,
              oldNullifierIdx,
              salt,
            )
            .encodeABI();
        }
        break;
      }
      // challenge incorrect leaf count
      case 7: {
        const priorBlockL2 = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);
        const priorBlockTransactions = await getTransactionsByTransactionHashes(
          priorBlockL2.transactionHashes,
        );
        txDataToSign = await challengeContractInstance.methods
          .challengeLeafCountCorrect(
            Block.buildSolidityStruct(priorBlockL2), // the block immediately prior to this one
            priorBlockTransactions.map(t => Transaction.buildSolidityStruct(t)), // the transactions in the prior block
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
    commitToChallenge(txDataToSign);
  } else {
    // only proposer not a challenger
    logger.info(
      "Faulty block detected. Don't submit new blocks until the faulty blocks are removed",
    );
  }
}
