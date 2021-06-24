import config from 'config';
import logger from '../utils/logger.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import {
  getBlockByBlockHash,
  getBlockByTransactionHash,
  retrieveMinedNullifiers,
  saveCommit,
  getTransactionsByTransactionHashes,
  getBlockByBlockNumberL2,
} from './database.mjs';
import { getTreeHistory } from '../utils/timber.mjs';
import Web3 from '../utils/web3.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import Transaction from '../classes/transaction.mjs';
import Block from '../classes/block.mjs';

const { CHALLENGES_CONTRACT_NAME } = config;

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
  ws.send(JSON.stringify({ type: 'commit', txDataToSign: commitToSign }));
  saveCommit(commitHash, txDataToSign);
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
        const priorBlockCommitmentsCount = priorBlockTransactions.reduce(
          (acc, priorBlockTransaction) => {
            return acc + priorBlockTransaction.commitments.length;
          },
          0,
        );

        const priorBlockHistory = await getTreeHistory(priorBlock.root);

        // Create a challenge
        txDataToSign = await challengeContractInstance.methods
          .challengeNewRootCorrect(
            Block.buildSolidityStruct(priorBlock),
            priorBlockTransactions.map(t => Transaction.buildSolidityStruct(t)),
            priorBlockHistory.frontier,
            Block.buildSolidityStruct(block),
            block.blockNumberL2,
            transactions.map(t => Transaction.buildSolidityStruct(t)),
            priorBlockHistory.leafIndex + priorBlockCommitmentsCount, // priorBlockHistory.leafIndex + number of commitments  in prior block
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
        const block2 = await getBlockByTransactionHash(transactionHash1);
        // Find the index of the duplication transaction in this block
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
      // invalid public input hash
      case 4: {
        const { transactionHashIndex: transactionIndex } = err.metadata;
        // Create a challenge (DEPOSIT has no historic root to worry about)
        if (transactions.transactionType === 'DEPOSIT') {
          txDataToSign = await challengeContractInstance.methods
            .challengePublicInputHash(
              Block.buildSolidityStruct(block),
              block.blockNumberL2,
              transactions.map(t => Transaction.buildSolidityStruct(t)),
              transactionIndex,
              salt,
            )
            .encodeABI();
        } else {
          const blockL2ContainingHistoricRoot = await getBlockByBlockNumberL2(
            transactions[transactionIndex].historicRootBlockNumberL2,
          );
          const transactionsOfblockL2ContainingHistoricRoot =
            await getTransactionsByTransactionHashes(
              blockL2ContainingHistoricRoot.transactionHashes,
            );
          txDataToSign = await challengeContractInstance.methods
            .challengePublicInputHash(
              Block.buildSolidityStruct(block),
              block.blockNumberL2,
              transactions.map(t => Transaction.buildSolidityStruct(t)),
              transactionIndex,
              Block.buildSolidityStruct(blockL2ContainingHistoricRoot),
              blockL2ContainingHistoricRoot.blockNumberL2,
              transactionsOfblockL2ContainingHistoricRoot.map(t =>
                Transaction.buildSolidityStruct(t),
              ),
              salt,
            )
            .encodeABI();
        }

        break;
      }
      // proof does not verify
      case 5: {
        const { transactionHashIndex: transactionIndex } = err.metadata;
        // Create a challenge
        const uncompressedProof = transactions[transactionIndex].proof;
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
