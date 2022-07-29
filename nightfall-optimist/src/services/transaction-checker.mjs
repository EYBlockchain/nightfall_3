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
import constants from 'common-files/constants/index.mjs';
import { Transaction, VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import { getBlockByBlockNumberL2 } from './database.mjs';
import verify from './verify.mjs';

const { ZERO, CHALLENGES_CONTRACT_NAME } = constants;
const { generalise } = gen;
const { PROVING_SCHEME, BACKEND, CURVE, BN128_GROUP_ORDER, MAX_PUBLIC_VALUES, RESTRICTIONS } =
  config;

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
  if (Number(transaction.nullifiers[0]) !== 0) {
    const historicRoot = await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[0]);
    if (historicRoot === null)
      throw new TransactionError('The historic root in the transaction does not exist', 3);
  }
  if (Number(transaction.nullifiers[1]) !== 0) {
    const historicRoot = await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[1]);
    if (historicRoot === null)
      throw new TransactionError('The historic root in the transaction does not exist', 3);
  }
  if (Number(transaction.nullifiersFee[0]) !== 0) {
    const historicRoot = await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2Fee[0]);
    if (historicRoot === null)
      throw new TransactionError('The historic root in the transaction does not exist', 3);
  }
  if (Number(transaction.nullifiersFee[1]) !== 0) {
    const historicRoot = await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2Fee[1]);
    if (historicRoot === null)
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
  const maticAddress = RESTRICTIONS.tokens[process.env.ETH_NETWORK].find(
    token => token.name === 'MATIC',
  ).address;

  if (![0, 1, 2].includes(Number(transaction.transactionType))) {
    throw new TransactionError('Unknown transaction type', 2);
  }
  const inputs = generalise(
    [
      transaction.value,
      transaction.fee,
      transaction.historicRootBlockNumberL2,
      transaction.historicRootBlockNumberL2Fee,
      transaction.transactionType,
      transaction.tokenType,
      generalise(transaction.tokenId).limbs(32, 8),
      transaction.ercAddress,
      generalise(transaction.recipientAddress).limbs(32, 8),
      transaction.commitments,
      transaction.nullifiers,
      transaction.commitmentFee,
      transaction.nullifiersFee,
      transaction.compressedSecrets,
      historicRootFirst.root,
      historicRootSecond.root,
      historicRootFeeFirst.root,
      historicRootFeeSecond.root,
      maticAddress,
    ].flat(Infinity),
  ).all.hex(32);

  if (
    isOverflow(transaction.ercAddress, MAX_PUBLIC_VALUES.ERCADDRESS) ||
    isOverflow(historicRootFirst.root, BN128_GROUP_ORDER) ||
    isOverflow(historicRootSecond.root, BN128_GROUP_ORDER) ||
    isOverflow(historicRootFeeFirst.root, BN128_GROUP_ORDER) ||
    isOverflow(historicRootFeeSecond.root, BN128_GROUP_ORDER) ||
    (isOverflow(transaction.recipientAddress, MAX_PUBLIC_VALUES.ERCADDRESS) &&
      transaction.transactionType === 2)
  ) {
    throw new TransactionError('Overflow in public input', 4);
  }

  for (let i = 0; i < transaction.nullifiers.length; i++) {
    if (isOverflow(transaction.nullifiers[i], MAX_PUBLIC_VALUES.NULLIFIER))
      throw new TransactionError('Overflow in public input', 4);
  }
  for (let i = 0; i < transaction.commitments.length; i++) {
    if (isOverflow(transaction.commitments[i], MAX_PUBLIC_VALUES.COMMITMENT))
      throw new TransactionError('Overflow in public input', 4);
  }

  for (let i = 0; i < transaction.nullifiersFee.length; i++) {
    if (isOverflow(transaction.nullifiersFee[i], MAX_PUBLIC_VALUES.NULLIFIER))
      throw new TransactionError('Overflow in public input', 4);
  }
  for (let i = 0; i < transaction.commitmentFee.length; i++) {
    if (isOverflow(transaction.commitmentFee[i], MAX_PUBLIC_VALUES.COMMITMENT))
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
