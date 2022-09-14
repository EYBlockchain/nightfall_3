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
import constants from 'common-files/constants/index.mjs';
import { VerificationKey, Proof, TransactionError } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import {
  getBlockByBlockNumberL2,
  getL2TransactionByCommitment,
  getL2TransactionByNullifier,
  getTransactionsByTransactionHashes,
  getLatestBlockInfo,
} from './database.mjs';
import verify from './verify.mjs';

const { generalise } = gen;
const { PROVING_SCHEME, BACKEND, CURVE } = config;
const { ZERO, CHALLENGES_CONTRACT_NAME, SHIELD_CONTRACT_NAME } = constants;

async function checkDuplicateCommitment(transaction, inL2AndNotInL2 = false, blockNumberL2OfTx) {
  // check if there are duplicate commitments in the same transaction
  transaction.commitments.forEach((commitment, index) => {
    const lastIndex = transaction.commitments.lastIndexOf(commitment);
    if (commitment !== ZERO && index !== lastIndex) {
      throw new TransactionError(
        `The transaction holds duplicate commitments with commitment hash ${commitment}`,
        0,
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

async function checkDuplicateNullifier(transaction, inL2AndNotInL2 = false, blockNumberL2OfTx) {
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

async function checkHistoricRootGreaterThanL2BlockNumberOnChain(transaction) {
  const { blockNumberL2: LatestL2BlockNumber } = await getLatestBlockInfo();
  transaction.historicRootBlockNumberL2.forEach(L2BlockNumber => {
    if (Number(L2BlockNumber) === 0 && LatestL2BlockNumber === -1) return;
    if (Number(L2BlockNumber) > LatestL2BlockNumber) {
      throw new TransactionError('Historic root has L2BlockNumber greater than OnChain', 3, {
        transactionHash: transaction.transactionHash,
      });
    }
  });
}

async function verifyProof(transaction) {
  // we'll need the verification key.  That's actually stored in the b/c
  const challengeInstance = await waitForContract(CHALLENGES_CONTRACT_NAME);
  const vkArray = await challengeInstance.methods
    .getVerificationKey(transaction.transactionType)
    .call();

  const circuitInfo = await challengeInstance.methods
    .getCircuitInfo(transaction.transactionType)
    .call();

  const { numberNullifiers, numberCommitments } = circuitInfo;

  // to verify a proof, we make use of a zokrates-worker, which has an offchain
  // verifier capability
  const historicRoots = await Promise.all(
    Array.from({ length: numberNullifiers }, () => 0).map((value, index) => {
      if (transaction.nullifiers[index] === ZERO) return { root: ZERO };
      return (
        getBlockByBlockNumberL2(transaction.historicRootBlockNumberL2[index]) ?? { root: ZERO }
      );
    }),
  );

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = await shieldContractInstance.methods.getMaticAddress().call();

  const inputs = generalise(
    [
      transaction.value,
      transaction.fee,
      transaction.transactionType,
      transaction.tokenType,
      transaction.historicRootBlockNumberL2.slice(0, numberNullifiers),
      generalise(transaction.tokenId).limbs(32, 8),
      transaction.ercAddress,
      generalise(transaction.recipientAddress).limbs(32, 8),
      transaction.commitments.slice(0, numberCommitments),
      transaction.nullifiers.slice(0, numberNullifiers),
      transaction.compressedSecrets,
      historicRoots.map(h => h.root),
      maticAddress.toLowerCase(),
    ].flat(Infinity),
  ).all.hex(32);

  const res = await verify({
    vk: new VerificationKey(vkArray, CURVE, PROVING_SCHEME),
    proof: new Proof(transaction.proof),
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
    curve: CURVE,
    inputs,
  });
  if (!res) throw new TransactionError('The proof did not verify', 2);
}

async function checkTransaction(transaction, inL2AndNotInL2 = false, args) {
  return Promise.all([
    checkDuplicateCommitment(transaction, inL2AndNotInL2, args?.blockNumberL2),
    checkDuplicateNullifier(transaction, inL2AndNotInL2, args?.blockNumberL2),
    checkHistoricRootGreaterThanL2BlockNumberOnChain(transaction),
    verifyProof(transaction),
  ]);
}

export default checkTransaction;
