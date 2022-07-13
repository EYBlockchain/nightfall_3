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

async function checkHistoricRoot(transaction) {
  // Deposit transaction have a historic root of 0
  // the validity is tested in checkTransactionType
  if (Number(transaction.transactionType) === 1) {
    const [historicRootFirst, historicRootSecond] = await Promise.all(
      transaction.historicRootBlockNumberL2.map(h => getBlockByBlockNumberL2(h)),
    );
    if (historicRootFirst === null || historicRootSecond === null)
      throw new TransactionError('The historic root in the transaction does not exist', 3);
  }
  if (Number(transaction.transactionType) === 1 || Number(transaction.transactionType) === 2) {
    const historicRootFirst = await getBlockByBlockNumberL2(
      transaction.historicRootBlockNumberL2[0],
    );
    if (historicRootFirst === null)
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
  const historicRootFirst =
    transaction.nullifiers[0] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[0])) ?? { root: ZERO };
  const historicRootSecond =
    transaction.nullifiers[1] === ZERO
      ? { root: ZERO }
      : (await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[1])) ?? { root: ZERO };

  const publicInputs = [
    transaction.value,
    transaction.historicRootBlockNumberL2,
    transaction.transactionType,
    transaction.tokenType,
    generalise(transaction.tokenId).limbs(32, 8),
    transaction.ercAddress,
    generalise(transaction.recipientAddress).limbs(32, 8),
    transaction.commitments,
    transaction.nullifiers,
    transaction.compressedSecrets,
  ].flat(Infinity);
  switch (Number(transaction.transactionType)) {
    case 0: // deposit transaction
      inputs = generalise(publicInputs).all.hex(32);
      if (
        isOverflow(transaction.ercAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
        isOverflow(transaction.commitments[0], MAX_PUBLIC_VALUES.COMMITMENTS)
      )
        throw new TransactionError('Truncated value overflow in public input', 4);
      break;
    case 1: // single transfer transaction
      inputs = generalise([
        ...publicInputs,
        historicRootFirst.root,
        historicRootSecond.root,
      ]).all.hex(32);
      // check for truncation overflow attacks
      if (
        isOverflow(historicRootFirst.root, BN128_GROUP_ORDER) ||
        isOverflow(historicRootSecond.root, BN128_GROUP_ORDER)
      )
        throw new TransactionError('Overflow in public input', 4);
      break;
    case 2: // withdraw transaction
      inputs = generalise([
        ...publicInputs,
        historicRootFirst.root,
        historicRootSecond.root,
      ]).all.hex(32);
      // check for truncation overflow attacks
      for (let i = 0; i < transaction.nullifiers.length; i++) {
        if (isOverflow(transaction.nullifiers[i], MAX_PUBLIC_VALUES.NULLIFIER))
          throw new TransactionError('Overflow in public input', 4);
      }
      for (let i = 0; i < transaction.commitments.length; i++) {
        if (isOverflow(transaction.commitments[i], MAX_PUBLIC_VALUES.COMMITMENT))
          throw new TransactionError('Overflow in public input', 4);
      }
      if (isOverflow(historicRootFirst.root, BN128_GROUP_ORDER))
        throw new TransactionError('Overflow in public input', 4);
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
    inputs,
  });
  if (!res) throw new TransactionError('The proof did not verify', 4);
}

async function checkTransaction(transaction) {
  return Promise.all([
    checkTransactionHash(transaction),
    checkHistoricRoot(transaction),
    verifyProof(transaction),
  ]);
}

export default checkTransaction;
