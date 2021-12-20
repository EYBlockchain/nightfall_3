import config from 'config';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import logger from 'common-files/utils/logger.mjs';
import Web3 from 'common-files/utils/web3.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
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

const IDENTITY_BLOCK = {
  proposer: '0x0000000000000000000000000000000000000000',
  root: '0x0000000000000000000000000000000000000000000000000000000000000000',
  leafCount: 0,
  blockNumberL2: 0,
  previousBlockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  nCommitments: 0,
  transactionHashes: [],
};
const { CHALLENGES_CONTRACT_NAME, TIMBER_HEIGHT, ZERO } = config;

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
  ws.send(JSON.stringify({ type: 'commit', txDataToSign: commitToSign }));
}

export async function revealChallenge(txDataToSign) {
  logger.debug('raw challenge transaction has been sent to be signed and submitted');
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
        let priorBlock;
        let priorPriorBlock;
        logger.debug('Challenging incorrect root');
        // Getting prior block for the current block
        if (block.blockNumberL2 === 0) {
          priorBlock = IDENTITY_BLOCK;
          priorPriorBlock = IDENTITY_BLOCK;
        } else {
          priorBlock = await getBlockByBlockNumberL2(Number(block.blockNumberL2) - 1);
          if (block.blockNumberL2 === 1) priorPriorBlock = IDENTITY_BLOCK;
          // We also need to grab the block 2 before the challenged block as it contains the frontier to
          else priorPriorBlock = await getBlockByBlockNumberL2(Number(block.blockNumberL2) - 2);
        }
        if (priorBlock === null) {
          throw new Error(
            `Could not find prior block with block number ${Number(block.blockNumberL2) - 1}`,
          );
        }
        // Retrieve last transaction from prior block using its transaction hash.
        // Note that not all transactions in a block will have commitments. Loop until one is found
        const priorBlockTransactions = await getTransactionsByTransactionHashes(
          priorBlock.transactionHashes,
        );

        // We also need to grab the block 2 before the challenged block as it contains the frontier to
        // calculate the root of the prior block.
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
            block.blockNumberL2,
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
            block.blockNumberL2,
            Block.buildSolidityStruct(block2),
            block2.blockNumberL2,
            transactions.map(t => Transaction.buildSolidityStruct(t)),
            transactions2.map(t => Transaction.buildSolidityStruct(t)),
            transactionIndex1, // index of duplicate transaction in block
            transactionIndex2,
            salt,
          )
          .encodeABI();
        break;
      }
      // invalid transaction type
      case 2: {
        const { transactionHashIndex: transactionIndex } = err.metadata;
        // Create a challenge
        txDataToSign = await challengeContractInstance.methods
          .challengeTransactionType(
            Block.buildSolidityStruct(block),
            block.blockNumberL2,
            transactions.map(t => Transaction.buildSolidityStruct(t)),
            transactionIndex,
            salt,
          )
          .encodeABI();
        logger.debug('returning raw transaction');
        logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
        break;
      }
      // historic root is incorrect
      case 3: {
        const { transactionHashIndex: transactionIndex } = err.metadata;
        // Create a challenge
        txDataToSign = await challengeContractInstance.methods
          .challengeHistoricRoot(
            Block.buildSolidityStruct(block),
            block.blockNumberL2,
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
        if (transactions[transactionIndex].transactionType === '0') {
          txDataToSign = await challengeContractInstance.methods
            .challengeProofVerification(
              Block.buildSolidityStruct(block),
              block.blockNumberL2,
              transactions.map(t => Transaction.buildSolidityStruct(t)),
              transactionIndex,
              uncompressedProof,
              salt,
            )
            .encodeABI();
        } else if (transactions[transactionIndex].transactionType === '2') {
          // Create a specific challenge for a double_transfer
          const [historicInput1, historicInput2] = await Promise.all(
            transactions[transactionIndex].historicRootBlockNumberL2.map(async b => {
              const historicBlock = await getBlockByBlockNumberL2(b);
              const historicTxs = await getTransactionsByTransactionHashes(block.transactionHashes);
              return {
                historicBlock,
                historicTxs,
              };
            }),
          );
          txDataToSign = await challengeContractInstance.methods
            .challengeProofVerification(
              Block.buildSolidityStruct(block),
              block.blockNumberL2,
              transactions.map(t => Transaction.buildSolidityStruct(t)),
              transactionIndex,
              Block.buildSolidityStruct(historicInput1.historicBlock),
              Block.buildSolidityStruct(historicInput2.historicBlock),
              historicInput1.historicBlock.blockNumberL2,
              historicInput2.historicBlock.blockNumberL2,
              historicInput1.historicTxs.map(t => Transaction.buildSolidityStruct(t)),
              historicInput2.historicTxs.map(t => Transaction.buildSolidityStruct(t)),
              uncompressedProof,
              salt,
            )
            .encodeABI();
        } else {
          const blockL2ContainingHistoricRoot = await getBlockByBlockNumberL2(
            transactions[transactionIndex].historicRootBlockNumberL2[0], // TODO
          );
          const transactionsOfblockL2ContainingHistoricRoot =
            await getTransactionsByTransactionHashes(
              blockL2ContainingHistoricRoot.transactionHashes,
            );
          txDataToSign = await challengeContractInstance.methods
            .challengeProofVerification(
              Block.buildSolidityStruct(block),
              block.blockNumberL2,
              transactions.map(t => Transaction.buildSolidityStruct(t)),
              transactionIndex,
              Block.buildSolidityStruct(blockL2ContainingHistoricRoot),
              blockL2ContainingHistoricRoot.blockNumberL2,
              transactionsOfblockL2ContainingHistoricRoot.map(t =>
                Transaction.buildSolidityStruct(t),
              ),
              uncompressedProof,
              salt,
            )
            .encodeABI();
        }
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
            .map((txs, txIndex) => [
              txIndex,
              txs.nullifiers.findIndex(oldN => oldN.toString() === n.hash),
            ])
            .filter(oldIdxs => oldIdxs[1] >= 0)
            .flat(Infinity);
          const [currentTxIdx, currentNullifierIdx] = transactions
            .map((txs, txIndex) => [
              txIndex,
              txs.nullifiers.findIndex(currN => currN.toString() === n.hash),
            ])
            .filter(currentIdx => currentIdx[1] >= 0)
            .flat(Infinity);
          txDataToSign = await challengeContractInstance.methods
            .challengeNullifier(
              Block.buildSolidityStruct(block),
              block.blockNumberL2,
              transactions.map(t => Transaction.buildSolidityStruct(t)),
              currentTxIdx,
              currentNullifierIdx,
              Block.buildSolidityStruct(oldBlock),
              oldBlock.blockNumberL2,
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
        let priorBlockL2;
        if (block.blockNumberL2 === 0) {
          priorBlockL2 = IDENTITY_BLOCK;
        } else {
          priorBlockL2 = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);
        }
        const priorBlockTransactions = await getTransactionsByTransactionHashes(
          priorBlockL2.transactionHashes,
        );
        txDataToSign = await challengeContractInstance.methods
          .challengeLeafCountCorrect(
            Block.buildSolidityStruct(priorBlockL2), // the block immediately prior to this one
            priorBlockTransactions.map(t => Transaction.buildSolidityStruct(t)), // the transactions in the prior block
            Block.buildSolidityStruct(block),
            block.blockNumberL2,
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
