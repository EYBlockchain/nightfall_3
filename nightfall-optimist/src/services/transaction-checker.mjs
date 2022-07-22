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

const { generalise, GN } = gen;
const {
  PROVING_SCHEME,
  BACKEND,
  CURVE,
  ZERO,
  CHALLENGES_CONTRACT_NAME,
  BN128_GROUP_ORDER,
  MAX_PUBLIC_VALUES,
} = config;

function isOverflow(value, check) {
  const bigValue = value.bigInt;
  if (bigValue < 0 || bigValue >= check) return true;
  return false;
}

// next that the fields provided are consistent with the transaction type
async function checkTransactionType(transaction) {
  switch (Number(transaction.transactionType)) {
    // Assuming nullifiers and commitments can't be valid ZEROs.
    // But points can such as compressedSecrets, Proofs
    case 0: // deposit
      if (
        (Number(transaction.tokenType) !== 0 &&
          transaction.tokenId === ZERO &&
          BigInt(transaction.value) === 0n) ||
        transaction.ercAddress === ZERO ||
        transaction.recipientAddress !== ZERO ||
        transaction.commitments[0] === ZERO ||
        transaction.commitments[1] !== ZERO ||
        transaction.commitments.length !== 2 ||
        transaction.nullifiers.some(n => n !== ZERO) ||
        transaction.compressedSecrets.some(cs => cs !== ZERO) ||
        transaction.compressedSecrets.length !== 2 ||
        transaction.proof.every(p => p === ZERO) ||
        // This extra check is unique to deposits
        Number(transaction.historicRootBlockNumberL2[0]) !== 0 ||
        Number(transaction.historicRootBlockNumberL2[1]) !== 0
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of DEPOSIT',
          0,
        );
      break;
    case 1: // single token transaction
      if (
        BigInt(transaction.value) !== 0n ||
        transaction.commitments[0] === ZERO ||
        transaction.commitments[1] !== ZERO ||
        transaction.commitments.length !== 2 ||
        transaction.nullifiers[0] === ZERO ||
        transaction.nullifiers[1] !== ZERO ||
        transaction.nullifiers.length !== 2 ||
        transaction.compressedSecrets.every(cs => cs === ZERO) ||
        transaction.compressedSecrets.length !== 2 ||
        transaction.proof.every(p => p === ZERO)
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of SINGLE_TRANSFER',
          0,
        );
      break;
    case 2: // double token transaction
      if (
        BigInt(transaction.value) !== 0n ||
        transaction.commitments.some(c => c === ZERO) ||
        transaction.commitments.length !== 2 ||
        transaction.nullifiers.some(n => n === ZERO) ||
        transaction.nullifiers.length !== 2 ||
        transaction.nullifiers[0] === transaction.nullifiers[1] ||
        transaction.compressedSecrets.every(cs => cs === ZERO) ||
        transaction.compressedSecrets.length !== 2 ||
        transaction.proof.every(p => p === ZERO)
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of DOUBLE_TRANSFER',
          0,
        );
      break;
    case 3: // withdraw transaction
      if (
        (Number(transaction.tokenType) !== 0 &&
          transaction.tokenId === ZERO &&
          BigInt(transaction.value) === 0n) ||
        transaction.ercAddress === ZERO ||
        transaction.recipientAddress === ZERO ||
        transaction.commitments.some(c => c !== ZERO) ||
        transaction.nullifiers[0] === ZERO ||
        transaction.nullifiers[1] !== ZERO ||
        transaction.nullifiers.length !== 2 ||
        transaction.compressedSecrets.some(cs => cs !== ZERO) ||
        transaction.proof.every(p => p === ZERO)
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of WITHDRAW',
          0,
        );
      break;
    default:
      throw new TransactionError('Unknown transaction type', 4);
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
  let inputs;
  const historicRootFirst = (await getBlockByBlockNumberL2(
    transaction.historicRootBlockNumberL2[0],
  )) ?? { root: ZERO };
  const historicRootSecond = (await getBlockByBlockNumberL2(
    transaction.historicRootBlockNumberL2[1],
  )) ?? { root: ZERO };

  const bin = new GN(transaction.recipientAddress).binary.padStart(256, '0');
  const parity = bin[0];
  const ordinate = bin.slice(1);
  const binaryEPub = [parity, new GN(ordinate, 'binary').field(BN128_GROUP_ORDER, false)];

  switch (Number(transaction.transactionType)) {
    case 0: // deposit transaction
      inputs = generalise(
        [
          transaction.ercAddress,
          generalise(transaction.tokenId).limbs(32, 8),
          transaction.value,
          transaction.commitments[0],
        ].flat(Infinity),
      );
      if (
        isOverflow(transaction.ercAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
        isOverflow(transaction.commitments[0], MAX_PUBLIC_VALUES.COMMITMENTS)
      )
        throw new TransactionError('Truncated value overflow in public input', 1);
      break;
    case 1: // single transfer transaction
      inputs = generalise(
        [
          transaction.commitments[0],
          transaction.nullifiers[0],
          historicRootFirst.root,
          binaryEPub,
          transaction.ercAddress,
          transaction.tokenId,
          ...transaction.compressedSecrets,
        ].flat(Infinity),
      );
      // check for truncation overflow attacks
      if (
        isOverflow(transaction.commitments[0], MAX_PUBLIC_VALUES.COMMITMENTS) ||
        isOverflow(transaction.nullifiers[0], MAX_PUBLIC_VALUES.NULLIFIER) ||
        isOverflow(historicRootFirst.root, BN128_GROUP_ORDER)
      )
        throw new TransactionError('Overflow in public input', 1);
      break;
    case 2: // double transfer transaction
      inputs = generalise(
        [
          transaction.commitments, // not truncating here as we already ensured hash < group order
          transaction.nullifiers,
          historicRootFirst.root,
          historicRootSecond.root,
          binaryEPub,
          transaction.ercAddress,
          transaction.tokenId,
          ...transaction.compressedSecrets,
        ].flat(Infinity),
      );
      // check for truncation overflow attacks
      for (let i = 0; i < transaction.nullifiers.length; i++) {
        if (isOverflow(transaction.nullifiers[i], MAX_PUBLIC_VALUES.NULLIFIER))
          throw new TransactionError('Overflow in public input', 1);
      }
      for (let i = 0; i < transaction.commitments.length; i++) {
        if (isOverflow(transaction.commitments[i], MAX_PUBLIC_VALUES.COMMITMENT))
          throw new TransactionError('Overflow in public input', 1);
      }
      if (
        isOverflow(historicRootFirst.root, BN128_GROUP_ORDER) ||
        isOverflow(historicRootSecond.root, BN128_GROUP_ORDER)
      )
        throw new TransactionError('Overflow in public input', 1);
      break;
    case 3: // withdraw transaction
      inputs = generalise(
        [
          transaction.ercAddress,
          generalise(transaction.tokenId).limbs(32, 8),
          transaction.value,
          transaction.nullifiers[0],
          transaction.recipientAddress,
          historicRootFirst.root,
        ].flat(Infinity),
      );
      // check for truncation overflow attacks
      if (
        isOverflow(transaction.ercAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
        isOverflow(transaction.recipientAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
        isOverflow(transaction.nullifiers[0], MAX_PUBLIC_VALUES.NULLIFIER) ||
        isOverflow(historicRootFirst.root, BN128_GROUP_ORDER)
      )
        throw new TransactionError('Truncated value overflow in public input', 1);
      break;
    default:
      throw new TransactionError('Unknown transaction type', 4);
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
    inputs: inputs.all.hex(32),
  });
  if (!res) throw new TransactionError('The proof did not verify', 1);
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
      2,
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
          2,
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
  if (
    transaction.nullifiers[0] !== ZERO &&
    transaction.nullifiers[0] === transaction.nullifiers[1]
  ) {
    throw new TransactionError(
      `The transaction holds duplicate nullifiers with nullifier hash ${transaction.nullifiers[0]}`,
      3,
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
          3,
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

export async function checkTransaction(transaction, inL2AndNotInL2 = false, args) {
  return Promise.all([
    checkTransactionType(transaction),
    checkDuplicateCommitment(transaction, inL2AndNotInL2, args?.blockNumberL2),
    checkDuplicateNullifier(transaction, inL2AndNotInL2, args?.blockNumberL2),
    verifyProof(transaction),
  ]);
}
