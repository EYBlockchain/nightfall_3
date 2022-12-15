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
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import * as snarkjs from 'snarkjs';
import { decompressProof } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import { VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import {
  getBlockByBlockNumberL2,
  getTransactionHashSiblingInfo,
  getTransactionMempoolByCommitment,
  getTransactionMempoolByNullifier,
  getTransactionL2ByCommitment,
  getTransactionL2ByNullifier,
} from './database.mjs';

const { generalise } = gen;
const { PROVING_SCHEME, CURVE } = config;
const { ZERO, STATE_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;

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
        const transactionMempoolHigherFee = await getTransactionMempoolByCommitment(
          commitment,
          transaction.fee,
        );

        if (transactionMempoolHigherFee !== null) {
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
        const transactionMempoolHigherFee = await getTransactionMempoolByNullifier(
          nullifier,
          transaction.fee,
        );

        if (transactionMempoolHigherFee !== null) {
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

async function checkHistoricRootBlockNumber(transaction) {
  const stateInstance = await waitForContract(STATE_CONTRACT_NAME);
  const latestBlockNumberL2 = Number(
    (await stateInstance.methods.getNumberOfL2Blocks().call()) - 1,
  );
  transaction.historicRootBlockNumberL2.forEach((blockNumberL2, i) => {
    if (transaction.nullifiers[i] === ZERO) {
      if (Number(blockNumberL2) !== 0) {
        throw new TransactionError('Invalid historic root', 3, {
          transactionHash: transaction.transactionHash,
        });
      }
    } else if (Number(blockNumberL2) > latestBlockNumberL2) {
      throw new TransactionError('Historic root has block number L2 greater than on chain', 3, {
        transactionHash: transaction.transactionHash,
      });
    }
  });
}

async function verifyProof(transaction) {
  // we'll need the verification key.  That's actually stored in the b/c
  const stateInstance = await waitForContract(STATE_CONTRACT_NAME);
  const vkArray = await stateInstance.methods.getVerificationKey(transaction.circuitHash).call();

  if (vkArray.length < 33) throw new TransactionError('The verification key is incorrect', 2);

  const historicRoots = await Promise.all(
    Array.from({ length: transaction.nullifiers.length }, () => 0).map((value, index) => {
      if (transaction.nullifiers[index] === ZERO) return { root: ZERO };
      return (
        getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[index]) ?? { root: ZERO }
      );
    }),
  );

  logger.debug({
    msg: 'The historic roots are the following',
    historicRoots: historicRoots.map(h => h.root),
  });

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const feeL2TokenAddress = (
    await shieldContractInstance.methods.getFeeL2TokenAddress().call()
  ).toLowerCase();

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
}) {
  return Promise.all([
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
    checkHistoricRootBlockNumber(transaction),
    verifyProof(transaction),
  ]);
}
