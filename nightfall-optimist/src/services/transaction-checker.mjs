/**
Module to check that a transaction is valid before it goes into a Block.
Here are the things that could be wrong with a transaction:
- the proof doesn't verify
- the transaction hash doesn't match with the preimage
- the transaction type is inconsistent with the fields populated
*/
import config from 'config';
import gen from 'general-number';
import logger from 'common-files/utils/logger.mjs';
import { Transaction, VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import { getBlockByBlockNumberL2 } from './database.mjs';
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

// first, let's check the hash. That's nice and easy:
// NB as we actually now comput the hash on receipt of the transaction this
// _should_ never fail.  Consider removal in the future.
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
          1,
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
          1,
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
          1,
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
          1,
        );
      break;
    default:
      throw new TransactionError('Unknown transaction type', 2);
  }
}

async function checkHistoricRoot(transaction) {
  // Deposit transaction have a historic root of 0
  // the validity is tested in checkTransactionType
  if (Number(transaction.transactionType) === 1 || Number(transaction.transactionType) === 3) {
    const historicRootFirst = await getBlockByBlockNumberL2(
      transaction.historicRootBlockNumberL2[0],
    );
    if (historicRootFirst === null)
      throw new TransactionError('The historic root in the transaction does not exist', 3);
  }
  if (Number(transaction.transactionType) === 2) {
    const [historicRootFirst, historicRootSecond] = await Promise.all(
      transaction.historicRootBlockNumberL2.map(h => getBlockByBlockNumberL2(h)),
    );
    if (historicRootFirst === null || historicRootSecond === null)
      throw new TransactionError('The historic root in the transaction does not exist', 3);
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
          transaction.tokenId,
          transaction.value,
          transaction.commitments[0],
        ].flat(Infinity),
      );
      if (
        isOverflow(transaction.ercAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
        isOverflow(transaction.commitments[0], MAX_PUBLIC_VALUES.COMMITMENTS)
      )
        throw new TransactionError('Truncated value overflow in public input', 4);
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
        throw new TransactionError('Overflow in public input', 4);
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
          throw new TransactionError('Overflow in public input', 4);
      }
      for (let i = 0; i < transaction.commitments.length; i++) {
        if (isOverflow(transaction.commitments[i], MAX_PUBLIC_VALUES.COMMITMENT))
          throw new TransactionError('Overflow in public input', 4);
      }
      if (
        isOverflow(historicRootFirst.root, BN128_GROUP_ORDER) ||
        isOverflow(historicRootSecond.root, BN128_GROUP_ORDER)
      )
        throw new TransactionError('Overflow in public input', 4);
      break;
    case 3: // withdraw transaction
      inputs = generalise(
        [
          transaction.ercAddress,
          transaction.tokenId,
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
        throw new TransactionError('Truncated value overflow in public input', 4);
      break;
    default:
      throw new TransactionError('Unknown transaction type', 2);
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
  if (!res) throw new TransactionError('The proof did not verify', 4);
}

async function checkTransaction(transaction) {
  return Promise.all([
    checkTransactionHash(transaction),
    checkTransactionType(transaction),
    checkHistoricRoot(transaction),
    verifyProof(transaction),
  ]);
}

export default checkTransaction;
