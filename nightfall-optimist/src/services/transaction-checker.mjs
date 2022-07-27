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
  const historicRootFirst = (await getBlockByBlockNumberL2(
    transaction.historicRootBlockNumberL2[0],
  )) ?? { root: ZERO };
  const historicRootSecond = (await getBlockByBlockNumberL2(
    transaction.historicRootBlockNumberL2[1],
  )) ?? { root: ZERO };

  const inputs = generalise(
    [
      generalise(transaction.value).limbs(8, 31),
      generalise(transaction.transactionType).limbs(32, 1),
      transaction.tokenType,
      generalise(transaction.tokenId).limbs(32, 8),
      transaction.ercAddress,
      generalise(transaction.recipientAddress).limbs(32, 8),
      generalise(transaction.commitments[0]).limbs(32, 7),
      generalise(transaction.commitments[1]).limbs(32, 7),
      generalise(transaction.nullifiers[0]).limbs(32, 7),
      generalise(transaction.nullifiers[1]).limbs(32, 7),
      ...transaction.historicRootBlockNumberL2,
      ...transaction.compressedSecrets,
      historicRootFirst.root,
      historicRootSecond.root,
    ].flat(Infinity),
  ).all.hex(32);

  if (
    isOverflow(transaction.ercAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
    isOverflow(transaction.commitments[0], MAX_PUBLIC_VALUES.COMMITMENTS) ||
    isOverflow(transaction.commitments[1], MAX_PUBLIC_VALUES.COMMITMENTS) ||
    isOverflow(transaction.nullifiers[0], MAX_PUBLIC_VALUES.NULLIFIER) ||
    isOverflow(transaction.nullifiers[1], MAX_PUBLIC_VALUES.NULLIFIER) ||
    isOverflow(historicRootFirst.root, BN128_GROUP_ORDER) ||
    isOverflow(historicRootSecond.root, BN128_GROUP_ORDER) ||
    (transaction.transactionType === 2 &&
      isOverflow(transaction.recipientAddress, MAX_PUBLIC_VALUES.ERCADDRESS))
  ) {
    throw new TransactionError('Overflow in public input', 4);
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
