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
import { VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import {
  getBlockByBlockNumberL2,
  getL2TransactionByCommitment,
  getL2TransactionByNullifier,
  getTransactionsByTransactionHashes,
} from './database.mjs';
import verify from './verify.mjs';

const { generalise } = gen;
const { PROVING_SCHEME, BACKEND, CURVE } = config;
const { ZERO, CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;

export async function checkDuplicateCommitment(
  transaction,
  inL2AndNotInL2 = false,
  blockNumberL2OfTx,
) {
  // check if there are duplicate commitments in the same transaction
  transaction.commitments.forEach((commitment, index) => {
    const lastIndex = transaction.commitments.lastIndexOf(commitment);
    if (commitment !== ZERO && index !== lastIndex) {
      throw new TransactionError(
        `The transaction holds duplicate commitments with commitment hash ${commitment}`,
        1,
        {
          transaction1: transaction,
          duplicateCommitment1Index: index,
          transaction2: transaction,
          duplicateCommitment2Index: lastIndex,
        },
      );
    }
  });

  // check if any commitment in the transaction is already part of an L2 block
  for (const [index, commitment] of transaction.commitments.entries()) {
    // transaction.commitments.forEach(async (commitment, index) => {
    const txWithOrgCommitment = await getL2TransactionByCommitment(
      commitment,
      inL2AndNotInL2,
      blockNumberL2OfTx,
    );
    if (commitment !== ZERO && txWithOrgCommitment !== null) {
      const blockWithOrgCommitment = await getBlockByBlockNumberL2(
        txWithOrgCommitment.blockNumberL2,
      );
      if (blockWithOrgCommitment !== null) {
        const orgBlockTransactions = await getTransactionsByTransactionHashes(
          blockWithOrgCommitment.transactionHashes,
        );
        throw new TransactionError(
          `The transaction has a duplicate commitment ${commitment}`,
          0,
          inL2AndNotInL2 === false
            ? {
                duplicateCommitment1Index: index,
                block2: blockWithOrgCommitment,
                transactions2: orgBlockTransactions,
                transaction2Index: blockWithOrgCommitment.transactionHashes.indexOf(
                  txWithOrgCommitment.transactionHash,
                ),
                duplicateCommitment2Index: txWithOrgCommitment.commitments.indexOf(commitment),
              }
            : undefined,
        );
      }
    }
  }
}

export async function checkDuplicateNullifier(
  transaction,
  inL2AndNotInL2 = false,
  blockNumberL2OfTx,
) {
  // check if there are duplicate nullifiers in the same transaction
  transaction.nullifiers.forEach((nullifier, index) => {
    const lastIndex = transaction.nullifiers.lastIndexOf(nullifier);
    if (nullifier !== ZERO && index !== lastIndex) {
      throw new TransactionError(
        `The transaction holds duplicate nullifiers with nullifier hash ${nullifier}`,
        1,
        {
          transaction1: transaction,
          duplicateNullifier1Index: index,
          transaction2: transaction,
          duplicateNullifier2Index: lastIndex,
        },
      );
    }
  });

  // check if any nullifier in the transction is already part of an L2 block
  for (const [index, nullifier] of transaction.nullifiers.entries()) {
    const txWithOrgNullifier = await getL2TransactionByNullifier(
      nullifier,
      inL2AndNotInL2,
      blockNumberL2OfTx,
    );
    if (nullifier !== ZERO && txWithOrgNullifier !== null) {
      const blockWithOrgNullifier = await getBlockByBlockNumberL2(txWithOrgNullifier.blockNumberL2);
      if (blockWithOrgNullifier !== null) {
        const orgBlockTransactions = await getTransactionsByTransactionHashes(
          blockWithOrgNullifier.transactionHashes,
        );
        throw new TransactionError(
          `The transaction has a duplicate nullifier ${nullifier}`,
          1,
          inL2AndNotInL2 === false
            ? {
                duplicateNullifier1Index: index,
                block2: blockWithOrgNullifier,
                transactions2: orgBlockTransactions,
                transaction2Index: blockWithOrgNullifier.transactionHashes.indexOf(
                  txWithOrgNullifier.transactionHash,
                ),
                duplicateNullifier2Index: txWithOrgNullifier.nullifiers.indexOf(nullifier),
              }
            : undefined,
        );
      }
    }
  }
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

  const maticAddress = await shieldContractInstance.methods.getMaticAddress().call();

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
      maticAddress.toLowerCase(),
    ].flat(Infinity),
  ).all.hex(32);

  const res = await verify({
    vk: new VerificationKey(vkArray),
    proof: new Proof(transaction.proof),
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
    curve: CURVE,
    inputs,
  });
  if (!res) throw new TransactionError('The proof did not verify', 2);
}

export async function checkTransaction(transaction, inL2AndNotInL2 = false, args) {
  return Promise.all([
    checkDuplicateCommitment(transaction, inL2AndNotInL2, args?.blockNumberL2),
    checkDuplicateNullifier(transaction, inL2AndNotInL2, args?.blockNumberL2),
    verifyProof(transaction),
  ]);
}
