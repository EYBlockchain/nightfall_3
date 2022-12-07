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
import { VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import {
  getBlockByBlockNumberL2,
  getL2TransactionByCommitment,
  getL2TransactionByNullifier,
  getTransactionHashSiblingInfo,
  getLatestBlockInfo,
} from './database.mjs';

const { generalise } = gen;
const { PROVING_SCHEME, CURVE } = config;
const { ZERO, STATE_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;

async function checkDuplicateCommitment(transaction, transactionFlags, txBlockNumberL2) {
  // Note: There is no need to check the duplicate commitment in the same transaction since this is already checked in the circuit
  // check if any commitment in the transaction is already part of an L2 block

  // Check if any transaction has a duplicated commitment
  for (const [index, commitment] of transaction.commitments.entries()) {
    if (commitment !== ZERO) {
      // Search if there is any transaction in L2 that already contains the commitment
      const transactionL2 = await getL2TransactionByCommitment(
        commitment,
        transactionFlags,
        txBlockNumberL2,
      );

      // If a transaction was found, means that the commitment is duplicated
      if (transactionL2 !== null) {
        // Get the number of the block in L2 containing the duplicated commitment
        const blockL2 = await getBlockByBlockNumberL2(transactionL2.blockNumberL2);

        if (blockL2 !== null) {
          const siblingPath2 = (await getTransactionHashSiblingInfo(transactionL2.transactionHash))
            .transactionHashSiblingPath;
          throw new TransactionError(
            `The transaction has a duplicate commitment ${commitment}`,
            0,
            transactionFlags.isAlreadyInMempool === false
              ? {
                  duplicateCommitment1Index: index,
                  block2: blockL2,
                  transaction2: transactionL2,
                  transaction2Index: blockL2.transactionHashes.indexOf(
                    transactionL2.transactionHash,
                  ),
                  siblingPath2,
                  duplicateCommitment2Index: transactionL2.commitments.indexOf(commitment),
                }
              : undefined,
          );
        }
      }
    }
  }
}

async function checkDuplicateNullifier(transaction, transactionFlags, txBlockNumberL2) {
  // Note: There is no need to check the duplicate nullifiers in the same transaction since this is already checked in the circuit
  // check if any nullifier in the transction is already part of an L2 block
  for (const [index, nullifier] of transaction.nullifiers.entries()) {
    if (nullifier !== ZERO) {
      // Search if there is any transaction in L2 that already contains the nullifier
      const transactionL2 = await getL2TransactionByNullifier(
        nullifier,
        transactionFlags,
        txBlockNumberL2,
      );

      // If a transaction was found, means that the nullifier is duplicated
      if (transactionL2 !== null) {
        const blockL2 = await getBlockByBlockNumberL2(transactionL2.blockNumberL2);
        if (blockL2 !== null) {
          const siblingPath2 = (await getTransactionHashSiblingInfo(transactionL2.transactionHash))
            .transactionHashSiblingPath;
          throw new TransactionError(
            `The transaction has a duplicate nullifier ${nullifier}`,
            1,
            transactionFlags.isAlreadyInMempool === false
              ? {
                  duplicateNullifier1Index: index,
                  block2: blockL2,
                  transaction2: transactionL2,
                  transaction2Index: blockL2.transactionHashes.indexOf(
                    transactionL2.transactionHash,
                  ),
                  siblingPath2,
                  duplicateNullifier2Index: transactionL2.nullifiers.indexOf(nullifier),
                }
              : undefined,
          );
        }
      }
    }
  }
}

async function checkHistoricRootBlockNumber(transaction) {
  const { blockNumberL2: LatestL2BlockNumber } = await getLatestBlockInfo();
  transaction.historicRootBlockNumberL2.forEach(L2BlockNumber => {
    if (Number(L2BlockNumber) === 0 && LatestL2BlockNumber === -1) return;
    if (Number(L2BlockNumber) > LatestL2BlockNumber) {
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

  if (vkArray.length < 33) throw new TransactionError('The proof did not verify', 2);

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

  const maticAddress = (
    await shieldContractInstance.methods.getMaticAddress().call()
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
      maticAddress,
    ].flat(Infinity),
  ).all.bigInt.map(inp => inp.toString());

  const vk = new VerificationKey(vkArray, CURVE, PROVING_SCHEME, inputs.length);

  const proof = new Proof(transaction.proof, CURVE, PROVING_SCHEME, inputs);

  const verifies = await snarkjs.groth16.verify(vk, inputs, proof);

  if (!verifies) throw new TransactionError('The proof did not verify', 2);
}

async function checkTransaction(
  transaction,
  { isAlreadyInL2 = false, isAlreadyInMempool = false },
  args,
) {
  return Promise.all([
    checkDuplicateCommitment(
      transaction,
      { isAlreadyInL2, isAlreadyInMempool },
      args?.blockNumberL2,
    ),
    checkDuplicateNullifier(
      transaction,
      { isAlreadyInL2, isAlreadyInMempool },
      args?.blockNumberL2,
    ),
    checkHistoricRootBlockNumber(transaction),
    verifyProof(transaction),
  ]);
}

export async function checkCommitmentsMempool(transaction) {
  for (const commitment of transaction.commitments) {
    if (commitment !== ZERO) {
      const originalTransaction = await getL2TransactionByCommitment(commitment, {
        isAlreadyInMempool: true,
      });
      // compare provided proposer fee in both transactions(duplicate and original)
      if (
        originalTransaction &&
        generalise(originalTransaction.fee).bigInt >= generalise(transaction.fee).bigInt
      )
        return false;
    }
  }
  return true;
}

export async function checkNullifiersMempool(transaction) {
  for (const nullifier of transaction.nullifiers) {
    if (nullifier !== ZERO) {
      const originalTransaction = await getL2TransactionByNullifier(nullifier, {
        isAlreadyInMempool: true,
      });
      // compare provided proposer fee in both transactions(duplicate and original)
      if (
        originalTransaction &&
        generalise(originalTransaction.fee).bigInt >= generalise(transaction.fee).bigInt
      )
        return false;
    }
  }
  return true;
}

export default checkTransaction;
