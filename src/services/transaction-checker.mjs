/**
Module to check that a transaction is valid before it goes into a Block.
Here are the things that could be wrong with a transaction:
- the proof doesn't verify
- the transaction hash doesn't match with the preimage
- the transaction type is inconsistent with the fields populated
- the public inputs hash is correct
*/
import config from 'config';
import axios from 'axios';
import Transaction from '../classes/transaction.mjs';
import VerificationKey from '../classes/verification-key.mjs';
import Proof from '../classes/proof.mjs';
import TransactionError from '../classes/transaction-error.mjs';
import PublicInputs from '../classes/public-inputs.mjs';
import { waitForShield } from '../event-handlers/subscribe.mjs';
import logger from '../utils/logger.mjs';

const { ZOKRATES_WORKER_URL, PROVING_SCHEME, BACKEND, CURVE, ZERO } = config;

// first, let's check the hash. That's nice and easy
async function checkTransactionHash(transaction) {
  if (!Transaction.checkHash(transaction)) {
    logger.debug(
      `The transaction with the hash that didn't match was ${JSON.stringify(transaction, null, 2)}`,
    );
    throw new TransactionError('The transaction hash did not match the transaction data', 0);
  }
}
// next that the fields provided are consistent with the transaction type
async function checkTransactionType(transaction) {
  switch (Number(transaction.transactionType)) {
    case 0: // deposit
      if (
        transaction.publicInputHash === ZERO ||
        (transaction.tokenId === ZERO && transaction.value === ZERO) ||
        transaction.ercAddress === ZERO ||
        transaction.recipientAddress !== ZERO ||
        transaction.commitments.some(c => c === ZERO) ||
        transaction.commitments.length !== 1 ||
        transaction.nullifiers.some(n => n !== ZERO) ||
        transaction.historicRoot !== ZERO ||
        transaction.proof.some(p => p === ZERO)
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of DEPOSIT',
          1,
        );
      break;
    case 1: // single token transaction
      if (
        transaction.publicInputHash === ZERO ||
        transaction.tokenId !== ZERO ||
        transaction.value !== ZERO ||
        transaction.ercAddress === ZERO ||
        transaction.recipientAddress !== ZERO ||
        transaction.commitments.some(c => c === ZERO) ||
        transaction.commitments.length !== 1 ||
        transaction.nullifiers.some(n => n === ZERO) ||
        transaction.nullifiers.length !== 1 ||
        transaction.historicRoot === ZERO ||
        transaction.proof.some(p => p === ZERO)
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of SINGLE_TRANSFER',
          1,
        );
      break;
    case 2: // double token transaction
      if (
        transaction.publicInputHash === ZERO ||
        transaction.tokenId !== ZERO ||
        transaction.value !== ZERO ||
        transaction.ercAddress === ZERO ||
        transaction.recipientAddress !== ZERO ||
        transaction.commitments.some(c => c === ZERO) ||
        transaction.commitments.length !== 2 ||
        transaction.nullifiers.some(n => n === ZERO) ||
        transaction.nullifiers.length !== 2 ||
        transaction.historicRoot === ZERO ||
        transaction.proof.some(p => p === ZERO)
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of DOUBLE_TRANSFER',
          1,
        );
      break;
    case 3: // withdraw transaction
      if (
        transaction.publicInputHash === ZERO ||
        (transaction.tokenId === ZERO && transaction.value === ZERO) ||
        transaction.ercAddress === ZERO ||
        transaction.recipientAddress === ZERO ||
        transaction.commitments.some(c => c !== ZERO) ||
        transaction.nullifiers.some(n => n === ZERO) ||
        transaction.nullifiers.length !== 1 ||
        transaction.historicRoot === ZERO ||
        transaction.proof.some(p => p === ZERO)
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of WITHDRAW',
          1,
        );
      break;
    default:
      throw new TransactionError('Unknown transaction type', 2);
  }
}

async function checkPublicInputHash(transaction) {
  switch (Number(transaction.transactionType)) {
    case 0: // deposit transaction
      if (
        transaction.publicInputHash !==
        new PublicInputs([
          transaction.ercAddress,
          transaction.tokenId,
          transaction.value,
          transaction.commitments,
        ]).hash.hex(32)
      )
        throw new TransactionError('public input hash is incorrect', 3);
      break;
    case 1: // single transfer transaction
      if (
        transaction.publicInputHash !==
        new PublicInputs([
          transaction.ercAddress,
          transaction.commitments,
          transaction.nullifiers,
          transaction.historicRoot,
        ]).hash.hex(32)
      )
        throw new TransactionError('public input hash is incorrect', 3);
      break;
    case 2: // double transfer transaction
      if (
        transaction.publicInputHash !==
        new PublicInputs([
          transaction.ercAddress, // this is correct; ercAddress appears twice
          transaction.ercAddress, // in a double-transfer public input hash
          transaction.commitments,
          transaction.nullifiers,
          transaction.historicRoot,
        ]).hash.hex(32)
      )
        throw new TransactionError('public input hash is incorrect', 3);
      break;
    case 3: // deposit transaction
      if (
        transaction.publicInputHash !==
        new PublicInputs([
          transaction.ercAddress,
          transaction.tokenId,
          transaction.value,
          transaction.nullifiers,
          transaction.recipientAddress,
          transaction.historicRoot,
        ]).hash.hex(32)
      )
        throw new TransactionError('public input hash is incorrect', 3);
      break;
    default:
      throw new TransactionError('Unknown transaction type', 2);
  }
}

async function verifyProof(transaction) {
  // we'll need the verification key.  That's actually stored in the b/c
  const shieldInstance = await waitForShield();
  const vkArray = await shieldInstance.methods
    .getVerificationKey(transaction.transactionType)
    .call();
  // to verify a proof, we make use of a zokrates-worker, which has an offchain
  // verifier capability
  const res = await axios.post(`http://${ZOKRATES_WORKER_URL}/verify`, {
    vk: new VerificationKey(vkArray),
    proof: new Proof(transaction.proof),
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
    curve: CURVE,
    inputs: [transaction.publicInputHash],
  });
  const { verifies } = res.data;
  if (!verifies) throw new TransactionError('The proof did not verify', 4);
}

function checkTransaction(transaction) {
  return Promise.all([
    checkTransactionHash(transaction),
    checkTransactionType(transaction),
    checkPublicInputHash(transaction),
    verifyProof(transaction),
  ]);
}

export default checkTransaction;
