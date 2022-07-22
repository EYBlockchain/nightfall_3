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
const { PROVING_SCHEME, BACKEND, CURVE, BN128_GROUP_ORDER, MAX_PUBLIC_VALUES } = config;
const { ZERO, CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;

function isOverflow(value, check) {
  const bigValue = value.bigInt;
  if (bigValue < 0 || bigValue >= check) return true;
  return false;
}

export async function checkDuplicateCommitment(
  transaction,
  inL2AndNotInL2 = false,
  blockNumberL2OfTx,
) {
  // check if there are duplicate commitments in the same transaction
  if (
    transaction.commitments[0] !== ZERO &&
    transaction.commitments[0] === transaction.commitments[1]
  ) {
    throw new TransactionError(
      `The transaction holds duplicate commitments with commitment hash ${transaction.commitments[0]}`,
      0,
      {
        transaction1: transaction,
        duplicateCommitment1Index: 0,
        transaction2: transaction,
        duplicateCommitment2Index: 1,
      },
    );
  }

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
                isFee2: false,
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
  if (
    transaction.nullifiers[0] !== ZERO &&
    transaction.nullifiers[0] === transaction.nullifiers[1]
  ) {
    throw new TransactionError(
      `The transaction holds duplicate nullifiers with nullifier hash ${transaction.nullifiers[0]}`,
      1,
      {
        transaction1: transaction,
        duplicateNullifier1Index: 0,
        transaction2: transaction,
        duplicateNullifier2Index: 1,
      },
    );
  }

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
                isFee2: false,
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

  const historicRootFeeFirst =
    transaction.nullifiersFee[0] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2Fee[0])) ?? {
          root: ZERO,
        };
  const historicRootFeeSecond =
    transaction.nullifiersFee[1] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2Fee[1])) ?? {
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
      transaction.historicRootBlockNumberL2Fee,
      generalise(transaction.tokenId).limbs(32, 8),
      transaction.ercAddress,
      generalise(transaction.recipientAddress).limbs(32, 8),
      transaction.commitments,
      transaction.nullifiers,
      transaction.commitmentFee,
      transaction.nullifiersFee,
      transaction.compressedSecrets,
    ].flat(Infinity),
  ).all.hex(32);

  if (Number(transaction.transactionType) !== 0) {
    inputs.push(generalise(historicRootFirst.root).hex(32));
    inputs.push(generalise(historicRootSecond.root).hex(32));
    inputs.push(generalise(historicRootFeeFirst.root).hex(32));
    inputs.push(generalise(historicRootFeeSecond.root).hex(32));
    inputs.push(generalise(maticAddress.toLowerCase()).hex(32));
  }

  if (
    isOverflow(transaction.ercAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
    isOverflow(historicRootFirst.root, BN128_GROUP_ORDER) ||
    isOverflow(historicRootSecond.root, BN128_GROUP_ORDER) ||
    isOverflow(historicRootFeeFirst.root, BN128_GROUP_ORDER) ||
    isOverflow(historicRootFeeSecond.root, BN128_GROUP_ORDER) ||
    (isOverflow(transaction.recipientAddress, MAX_PUBLIC_VALUES.ERCADDRESS) &&
      transaction.transactionType === 2)
  ) {
    throw new TransactionError('Overflow in public input', 2);
  }

  for (let i = 0; i < transaction.nullifiers.length; i++) {
    if (isOverflow(transaction.nullifiers[i], MAX_PUBLIC_VALUES.NULLIFIER))
      throw new TransactionError('Overflow in public input', 2);
  }
  for (let i = 0; i < transaction.commitments.length; i++) {
    if (isOverflow(transaction.commitments[i], MAX_PUBLIC_VALUES.COMMITMENT))
      throw new TransactionError('Overflow in public input', 2);
  }

  for (let i = 0; i < transaction.nullifiersFee.length; i++) {
    if (isOverflow(transaction.nullifiersFee[i], MAX_PUBLIC_VALUES.NULLIFIER))
      throw new TransactionError('Overflow in public input', 2);
  }
  for (let i = 0; i < transaction.commitmentFee.length; i++) {
    if (isOverflow(transaction.commitmentFee[i], MAX_PUBLIC_VALUES.COMMITMENT))
      throw new TransactionError('Overflow in public input', 2);
  }
  // check for modular overflow attacks
  // if (inputs.filter(input => input.bigInt >= BN128_GROUP_ORDER).length > 0)
  //  throw new TransactionError('Modular overflow in public input', 4);
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
