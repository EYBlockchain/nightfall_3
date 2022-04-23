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

const { generalise } = gen;
const { PROVING_SCHEME, BACKEND, CURVE, ZERO, ZERO31, CHALLENGES_CONTRACT_NAME } = config;
const MAX_NULLIFIER = 2n ** 249n - 1n; // constrain to 31 bytes

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
        transaction.nullifiers.some(n => n !== ZERO31) ||
        transaction.compressedSecrets.some(cs => cs !== ZERO) ||
        transaction.compressedSecrets.length !== 8 ||
        transaction.proof.every(p => p === ZERO) ||
        // This extra check is unique to deposits
        Number(transaction.historicRootBlockNumberL2[0]) !== 0 ||
        Number(transaction.historicRootBlockNumberL2[1]) !== 0 ||
        BigInt(transaction.nullifiers[0]) > MAX_NULLIFIER ||
        BigInt(transaction.nullifiers[1]) > MAX_NULLIFIER
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of DEPOSIT',
          1,
        );
      break;
    case 1: // single token transaction
      if (
        transaction.tokenId !== ZERO ||
        BigInt(transaction.value) !== 0n ||
        transaction.ercAddress !== ZERO ||
        transaction.recipientAddress !== ZERO ||
        transaction.commitments[0] === ZERO ||
        transaction.commitments[1] !== ZERO ||
        transaction.commitments.length !== 2 ||
        transaction.nullifiers[0] === ZERO31 ||
        transaction.nullifiers[1] !== ZERO31 ||
        transaction.nullifiers.length !== 2 ||
        transaction.compressedSecrets.every(cs => cs === ZERO) ||
        transaction.compressedSecrets.length !== 8 ||
        transaction.proof.every(p => p === ZERO) ||
        BigInt(transaction.nullifiers[0]) > MAX_NULLIFIER ||
        BigInt(transaction.nullifiers[1]) > MAX_NULLIFIER
      )
        throw new TransactionError(
          'The data provided was inconsistent with a transaction type of SINGLE_TRANSFER',
          1,
        );
      break;
    case 2: // double token transaction
      if (
        transaction.tokenId !== ZERO ||
        BigInt(transaction.value) !== 0n ||
        transaction.ercAddress !== ZERO ||
        transaction.recipientAddress !== ZERO ||
        transaction.commitments.some(c => c === ZERO) ||
        transaction.commitments.length !== 2 ||
        transaction.nullifiers.some(n => n === ZERO31) ||
        transaction.nullifiers.length !== 2 ||
        transaction.nullifiers[0] === transaction.nullifiers[1] ||
        transaction.compressedSecrets.every(cs => cs === ZERO) ||
        transaction.compressedSecrets.length !== 8 ||
        transaction.proof.every(p => p === ZERO) ||
        BigInt(transaction.nullifiers[0]) > MAX_NULLIFIER ||
        BigInt(transaction.nullifiers[1]) > MAX_NULLIFIER
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
        transaction.nullifiers[0] === ZERO31 ||
        transaction.nullifiers[1] !== ZERO31 ||
        transaction.nullifiers.length !== 2 ||
        transaction.compressedSecrets.some(cs => cs !== ZERO) ||
        transaction.proof.every(p => p === ZERO) ||
        BigInt(transaction.nullifiers[0]) > MAX_NULLIFIER ||
        BigInt(transaction.nullifiers[1]) > MAX_NULLIFIER
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

  switch (Number(transaction.transactionType)) {
    case 0: // deposit transaction
      inputs = generalise(
        [
          transaction.ercAddress,
          transaction.tokenId,
          transaction.value,
          transaction.commitments[0], // not truncating here as we already ensured hash < group order
        ].flat(Infinity),
      );
      break;
    case 1: // single transfer transaction
      inputs = generalise(
        [
          // transaction.ercAddress,
          transaction.commitments[0], // not truncating here as we already ensured hash < group order
          transaction.nullifiers[0],
          historicRootFirst.root,
          ...transaction.compressedSecrets.map(compressedSecret =>
            generalise(compressedSecret).hex(32, 31),
          ),
        ].flat(Infinity),
      );
      break;
    case 2: // double transfer transaction
      inputs = generalise(
        [
          // transaction.ercAddress, // this is correct; ercAddress appears twice
          // transaction.ercAddress, // in a double-transfer public input hash
          transaction.commitments, // not truncating here as we already ensured hash < group order
          transaction.nullifiers,
          historicRootFirst.root,
          historicRootSecond.root,
          ...transaction.compressedSecrets.map(compressedSecret =>
            generalise(compressedSecret).hex(32, 31),
          ),
        ].flat(Infinity),
      );
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
      break;
    default:
      throw new TransactionError('Unknown transaction type', 2);
  }
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
