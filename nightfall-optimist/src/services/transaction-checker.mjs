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
import { VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import {
  getBlockByBlockNumberL2,
  getL2TransactionByCommitment,
  getL2TransactionByNullifier,
  getTransactionHashSiblingInfo,
  getLatestBlockInfo,
} from './database.mjs';
import verify from './verify.mjs';

const { generalise } = gen;
const { PROVING_SCHEME, BACKEND, CURVE } = config;
const { ZERO, CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;

async function checkDuplicateCommitment(transaction, inL2AndNotInL2 = false, txBlockNumberL2) {
  // Note: There is no need to check the duplicate commitment in the same transaction since this is already checked in the circuit
  // check if any commitment in the transaction is already part of an L2 block

  // Check if any transaction has a duplicated commitment
  for (const [index, commitment] of transaction.commitments.entries()) {
    if (commitment !== ZERO) {
      // Search if there is any transaction in L2 that already contains the commitment
      const transactionL2 = await getL2TransactionByCommitment(
        commitment,
        inL2AndNotInL2,
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
            inL2AndNotInL2 === false
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

async function checkDuplicateNullifier(transaction, inL2AndNotInL2 = false, txBlockNumberL2) {
  // Note: There is no need to check the duplicate nullifiers in the same transaction since this is already checked in the circuit
  // check if any nullifier in the transction is already part of an L2 block
  for (const [index, nullifier] of transaction.nullifiers.entries()) {
    if (nullifier !== ZERO) {
      // Search if there is any transaction in L2 that already contains the nullifier
      const transactionL2 = await getL2TransactionByNullifier(
        nullifier,
        inL2AndNotInL2,
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
            inL2AndNotInL2 === false
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
      throw new TransactionError('Historic root has L2BlockNumber greater than OnChain', 3, {
        transactionHash: transaction.transactionHash,
      });
    }
  });
}

async function verifyProof(transaction) {
  // we'll need the verification key.  That's actually stored in the b/c
  const challengeInstance = await waitForContract(CHALLENGES_CONTRACT_NAME);
  const vkArray = await challengeInstance.methods
    .getVerificationKey(transaction.transactionType)
    .call();
  // to verify a proof, we make use of a zokrates-worker, which has an offchain
  // verifier capability
  const historicRootFirst =
    transaction.nullifiers[0] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[0])) ?? { root: ZERO };
  const historicRootSecond =
    transaction.nullifiers[1] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[1])) ?? { root: ZERO };

  const historicRootThird =
    transaction.nullifiers[2] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[2])) ?? {
          root: ZERO,
        };
  const historicRootFourth =
    transaction.nullifiers[3] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[3])) ?? {
          root: ZERO,
        };

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = (
    await shieldContractInstance.methods.getMaticAddress().call()
  ).toLowerCase();

  const inputs = generalise(
    [
      transaction.value,
      transaction.fee,
      transaction.transactionType,
      transaction.tokenType,
      transaction.historicRootBlockNumberL2,
      generalise(transaction.tokenId).limbs(32, 8),
      transaction.ercAddress,
      generalise(transaction.recipientAddress).limbs(32, 8),
      transaction.commitments,
      transaction.nullifiers,
      transaction.compressedSecrets,
      historicRootFirst.root,
      historicRootSecond.root,
      historicRootThird.root,
      historicRootFourth.root,
      maticAddress,
    ].flat(Infinity),
  ).all.hex(32);

  const res = await verify({
    vk: new VerificationKey(vkArray, CURVE, PROVING_SCHEME),
    proof: new Proof(transaction.proof),
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
    curve: CURVE,
    inputs,
  });
  if (!res) throw new TransactionError('The proof did not verify', 2);
}

async function checkTransaction(transaction, inL2AndNotInL2 = false, args) {
  return Promise.all([
    checkDuplicateCommitment(transaction, inL2AndNotInL2, args?.blockNumberL2),
    checkDuplicateNullifier(transaction, inL2AndNotInL2, args?.blockNumberL2),
    checkHistoricRootBlockNumber(transaction),
    verifyProof(transaction),
  ]);
}

export default checkTransaction;
