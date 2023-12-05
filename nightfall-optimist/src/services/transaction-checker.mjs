/* eslint-disable no-await-in-loop */
/**
Module to check that a transaction is valid
Here are the things that could be wrong with a transaction:
- the proof doesn't verify
- transaction has a duplicate commitment
- transaction has a duplicate nullifier
*/

import config from 'config';
import gen from 'general-number';
import constants from 'common-files/constants/index.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import * as snarkjs from 'snarkjs';
import { decompressProof } from 'common-files/utils/curve-maths/curves.mjs';
import { VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import {
  getBlockByBlockNumberL2,
  getTransactionHashSiblingInfo,
  getMempoolTransactionByCommitment,
  getMempoolTransactionByNullifier,
  getTransactionL2ByCommitment,
  getTransactionL2ByNullifier,
} from './database.mjs';

const { generalise } = gen;
const { PROVING_SCHEME, CURVE } = config;
const { ZERO, STATE_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;
const CACHE_VERIFICATION_KEY = new Map();
const CACHE_FEE_L2_TOKEN_ADDRESS = new Map();

async function checkDuplicateCommitment({
  transaction,
  checkDuplicatesInL2,
  checkDuplicatesInMempool,
  transactionBlockNumberL2,
}) {
  // Note: There is no need to check the duplicate commitment in the same transaction since this is already checked in the circuit
  // check if any commitment in the transaction is already part of an L2 block

  // Check if any transaction has a duplicated commitment
  for (const [index, commitment] of transaction.commitments.entries()) {
    if (commitment !== ZERO) {
      if (checkDuplicatesInMempool) {
        const transactionMempoolHigherFee = await getMempoolTransactionByCommitment(
          commitment,
          transaction.fee,
        );

        if (transactionMempoolHigherFee !== null) {
          logger.debug({
            msg: 'Duplicate mempool commitment with higher fee: ',
            transactionMempoolHigherFee,
          });
          throw new TransactionError(
            `The transaction has a duplicate commitment ${commitment} in the mempool with a higher fee`,
            0,
            undefined,
          );
        }
      }

      if (checkDuplicatesInL2) {
        // Search if there is any transaction in L2 that already contains the commitment
        const transactionL2 = await getTransactionL2ByCommitment(
          commitment,
          transactionBlockNumberL2,
        );
        // If a transaction was found, means that the commitment is duplicated
        if (transactionL2 !== null) {
          // Get the number of the block in L2 containing the duplicated commitment
          const blockL2 = await getBlockByBlockNumberL2(transactionL2.blockNumberL2);

          if (blockL2 !== null) {
            const siblingPath2 = (
              await getTransactionHashSiblingInfo(transactionL2.transactionHash)
            ).transactionHashSiblingPath;
            throw new TransactionError(
              `The transaction has a duplicate commitment ${commitment} in a previous L2 block`,
              0,
              {
                duplicateCommitment1Index: index,
                block2: blockL2,
                transaction2: transactionL2,
                transaction2Index: blockL2.transactionHashes.indexOf(transactionL2.transactionHash),
                siblingPath2,
                duplicateCommitment2Index: transactionL2.commitments.indexOf(commitment),
              },
            );
          }
        }
      }
    }
  }
}

async function checkDuplicateNullifier({
  transaction,
  checkDuplicatesInL2,
  checkDuplicatesInMempool,
  transactionBlockNumberL2,
}) {
  // Note: There is no need to check the duplicate nullifiers in the same transaction since this is already checked in the circuit
  // check if any nullifier in the transction is already part of an L2 block
  for (const [index, nullifier] of transaction.nullifiers.entries()) {
    if (nullifier !== ZERO) {
      if (checkDuplicatesInMempool) {
        const transactionMempoolHigherFee = await getMempoolTransactionByNullifier(
          nullifier,
          transaction.fee,
        );

        if (transactionMempoolHigherFee !== null) {
          logger.debug({
            msg: 'Duplicate mempool nullifier with higher fee: ',
            transactionMempoolHigherFee,
          });
          throw new TransactionError(
            `The transaction has a duplicate commitment ${nullifier} in the mempool with a higher fee`,
            1,
            undefined,
          );
        }
      }

      if (checkDuplicatesInL2) {
        // Search if there is any transaction in L2 that already contains the commitment
        const transactionL2 = await getTransactionL2ByNullifier(
          nullifier,
          transactionBlockNumberL2,
        );
        // If a transaction was found, means that the commitment is duplicated
        if (transactionL2 !== null) {
          // Get the number of the block in L2 containing the duplicated commitment
          const blockL2 = await getBlockByBlockNumberL2(transactionL2.blockNumberL2);

          if (blockL2 !== null) {
            const siblingPath2 = (
              await getTransactionHashSiblingInfo(transactionL2.transactionHash)
            ).transactionHashSiblingPath;
            throw new TransactionError(
              `The transaction has a duplicate nullifier ${nullifier} in a previous L2 block`,
              1,
              {
                duplicateNullifier1Index: index,
                block2: blockL2,
                transaction2: transactionL2,
                transaction2Index: blockL2.transactionHashes.indexOf(transactionL2.transactionHash),
                siblingPath2,
                duplicateNullifier2Index: transactionL2.nullifiers.indexOf(nullifier),
              },
            );
          }
        }
      }
    }
  }
}

async function checkHistoricRootBlockNumber(
  transaction,
  lastValidBlockNumberL2,
  stateConractInstance,
) {
  let latestBlockNumberL2;
  if (lastValidBlockNumberL2) {
    latestBlockNumberL2 = lastValidBlockNumberL2;
  } else {
    latestBlockNumberL2 =
      Number(await stateConractInstance.methods.getNumberOfL2Blocks()) - Number(1);
  }

  logger.debug({ msg: `Latest valid block number in L2`, latestBlockNumberL2 });

  transaction.historicRootBlockNumberL2.forEach((blockNumberL2, i) => {
    if (transaction.nullifiers[i] === ZERO) {
      if (Number(blockNumberL2) !== 0) {
        throw new TransactionError('Invalid historic root', 3, {
          transactionHash: transaction.transactionHash,
        });
      }
    } else if (Number(blockNumberL2) > latestBlockNumberL2) {
      throw new TransactionError(
        `Historic root block number, which is ${Number(
          blockNumberL2,
        )}, has block number L2 greater than on chain, which is ${latestBlockNumberL2}`,
        3,
        {
          transactionHash: transaction.transactionHash,
        },
      );
    }
  });
}

async function verifyProof(transaction, stateConractInstance, shieldContractInstance) {
  const vkArrayCached = CACHE_VERIFICATION_KEY.get(transaction.circuitHash);
  const vkArray =
    vkArrayCached ??
    (await stateConractInstance.methods.getVerificationKey(transaction.circuitHash).call());
  if (!vkArrayCached) {
    CACHE_VERIFICATION_KEY.set(transaction.circuitHash, vkArray);
  }

  if (vkArray.length < 33) throw new TransactionError('The verification key is incorrect', 2);

  const historicRoots = await Promise.all(
    Array.from({ length: transaction.nullifiers.length }, () => 0).map((value, index) => {
      if (transaction.nullifiers[index] === ZERO) return { root: ZERO };
      return (
        getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[index]) ?? { root: ZERO }
      );
    }),
  );

  logger.info({
    msg: 'Constructing proof with blockNumberL2s and roots',
    transaction: transaction.transactionHash,
    blockNumberL2s: transaction.historicRootBlockNumberL2.map(r => Number(r)),
    roots: historicRoots.map(h => h.root),
  });

  const feeL2TokenAddressCached = CACHE_FEE_L2_TOKEN_ADDRESS.get(transaction.circuitHash);
  const feeL2TokenAddress =
    feeL2TokenAddressCached ??
    (await shieldContractInstance.methods.getFeeL2TokenAddress().call()).toLowerCase();
  if (!feeL2TokenAddressCached) {
    CACHE_FEE_L2_TOKEN_ADDRESS.set(transaction.circuitHash, feeL2TokenAddress);
  }

  const inputs = generalise(
    [
      transaction.value,
      transaction.fee,
      transaction.circuitHash,
      transaction.tokenType,
      transaction.historicRootBlockNumberL2,
      transaction.ercAddress,
      generalise(transaction.tokenId).limbs(32, 8),
      transaction.recipientAddress,
      transaction.commitments,
      transaction.nullifiers,
      transaction.compressedSecrets,
      historicRoots.map(h => h.root),
      feeL2TokenAddress,
    ].flat(Infinity),
  ).all.bigInt.map(inp => inp.toString());

  const vk = new VerificationKey(vkArray, CURVE, PROVING_SCHEME, inputs.length);

  try {
    const uncompressedProof = decompressProof(transaction.proof);
    const proof = new Proof(uncompressedProof, CURVE, PROVING_SCHEME, inputs);

    const verifies = await snarkjs.groth16.verify(vk, inputs, proof);

    if (!verifies) throw new TransactionError('The proof did not verify', 2);
  } catch (e) {
    if (e instanceof TransactionError) {
      throw e;
    } else {
      // Decompressing the Proof failed
      throw new TransactionError('Decompression failed', 2);
    }
  }
}

// eslint-disable-next-line import/prefer-default-export
export async function checkTransaction({
  transaction,
  checkDuplicatesInL2 = false,
  checkDuplicatesInMempool = false,
  transactionBlockNumberL2,
  lastValidBlockNumberL2,
}) {
  const [stateConractInstance, shieldContractInstance] = await Promise.all([
    waitForContract(STATE_CONTRACT_NAME),
    waitForContract(SHIELD_CONTRACT_NAME),
  ]);

  await Promise.all([
    checkDuplicateCommitment({
      transaction,
      checkDuplicatesInL2,
      checkDuplicatesInMempool,
      transactionBlockNumberL2,
    }),
    checkDuplicateNullifier({
      transaction,
      checkDuplicatesInL2,
      checkDuplicatesInMempool,
      transactionBlockNumberL2,
    }),
    checkHistoricRootBlockNumber(transaction, lastValidBlockNumberL2, stateConractInstance),
  ]);
  await verifyProof(transaction, stateConractInstance, shieldContractInstance);
}
