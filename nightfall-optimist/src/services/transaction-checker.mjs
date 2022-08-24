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

const { generalise } = gen;
const { PROVING_SCHEME, BACKEND, CURVE } = config;
const { ZERO, CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;

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
  if (Number(transaction.nullifiers[2]) !== 0) {
    const historicRoot = await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[2]);
    if (historicRoot === null)
      throw new TransactionError('The historic root in the transaction does not exist', 3);
  }
  if (Number(transaction.nullifiers[3]) !== 0) {
    const historicRoot = await getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[3]);
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
