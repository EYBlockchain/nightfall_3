/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import sha256 from '../utils/crypto/sha256.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';
import { findUsableCommitments, storeCommitment, markNullified } from './commitment-storage.mjs';
import Nullifier from '../classes/nullifier.mjs';
import Commitment from '../classes/commitment.mjs';
import PublicInputs from '../classes/public-inputs.mjs';
import { getSiblingPath } from '../utils/timber.mjs';
import Transaction from '../classes/transaction.mjs';

const {
  BN128_PRIME,
  ZKP_KEY_LENGTH,
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  SHIELD_CONTRACT_NAME,
  PROTOCOL,
  USE_STUBS,
} = config;
const { generalise, GN } = gen;

async function transfer(items) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { ercAddress, tokenId, recipientData, senderZkpPrivateKey, fee } = generalise(items);
  const { recipientZkpPublicKeys, values } = recipientData;
  const senderZkpPublicKey = sha256([senderZkpPrivateKey]);
  if (recipientZkpPublicKeys.length > 1)
    throw new Error('Batching is not supported yet: only one recipient is allowed'); // this will not always be true so we try to make the following code agnostic to the number of commitments

  // the first thing we need to do is to find some input commitments which
  // will enable us to conduct our transfer.  Let's rummage in the db...
  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  const oldCommitments = await findUsableCommitments(
    senderZkpPublicKey,
    ercAddress,
    tokenId,
    totalValueToSend,
  );
  if (oldCommitments) logger.debug(`Found commitments ${JSON.stringify(oldCommitments, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments
  // Having found either 1 or 2 commitments, which are suitable inputs to the
  // proof, the next step is to compute their nullifiers;
  const nullifiers = oldCommitments.map(
    commitment => new Nullifier(commitment, senderZkpPrivateKey),
  );
  // then the new output commitment(s)
  const totalInputCommitmentValue = oldCommitments.reduce(
    (acc, commitment) => acc + commitment.preimage.value.bigInt,
    0n,
  );
  // we may need to return change to the recipient
  const change = totalInputCommitmentValue - totalValueToSend;
  // if so, add an output commitment to do that
  if (change !== 0n) {
    values.push(new GN(change));
    recipientZkpPublicKeys.push(senderZkpPublicKey);
  }
  const newCommitments = [];
  for (let i = 0; i < recipientZkpPublicKeys.length; i++) {
    newCommitments.push(
      new Commitment({
        zkpPublicKey: recipientZkpPublicKeys[i],
        ercAddress,
        tokenId,
        value: values[i],
        salt: await rand(ZKP_KEY_LENGTH),
      }),
    );
  }
  // and the Merkle path(s) from the commitment(s) to the root
  const siblingPaths = generalise(
    await Promise.all(
      oldCommitments.map(async commitment => getSiblingPath(await commitment.index)),
    ),
  );
  logger.silly(`SiblingPaths were: ${JSON.stringify(siblingPaths)}`);
  // public inputs
  const root = siblingPaths[0][0];
  const publicInputs = new PublicInputs([
    oldCommitments.map(commitment => commitment.preimage.ercAddress),
    newCommitments.map(commitment => commitment.hash),
    nullifiers.map(nullifier => nullifier.hash),
    root,
  ]);
  // time for a quick sanity check.  We expect the number of old commitments,
  // new commitments and nullifiers to be equal.
  if (nullifiers.length !== oldCommitments.length || nullifiers.length !== newCommitments.length) {
    logger.error(
      `number of old commitments: ${oldCommitments.length}, number of new commitments: ${newCommitments.length}, number of nullifiers: ${nullifiers.length}`,
    );
    throw new Error(
      'Commitment or nullifier numbers are mismatched.  There should be equal numbers of each',
    );
  }

  // now we have everything we need to create a Witness and compute a proof
  const witness = [
    publicInputs.hash.decimal, // TODO safer to make this a prime field??
    oldCommitments.map(commitment => [
      commitment.preimage.ercAddress.limbs(32, 8),
      commitment.preimage.tokenId.limbs(32, 8),
      commitment.preimage.value.limbs(32, 8),
      commitment.preimage.salt.limbs(32, 8),
      commitment.hash.limbs(32, 8),
    ]),
    newCommitments.map(commitment => [
      commitment.preimage.zkpPublicKey.limbs(32, 8),
      commitment.preimage.value.limbs(32, 8),
      commitment.preimage.salt.limbs(32, 8),
      commitment.hash.limbs(32, 8),
    ]),
    nullifiers.map(nullifier => [
      nullifier.preimage.zkpPrivateKey.limbs(32, 8),
      nullifier.hash.limbs(32, 8),
    ]),
    siblingPaths.map(siblingPath => siblingPath.map(node => node.field(BN128_PRIME, false))), // siblingPAth[32] is a sha hash and will overflow a field but it's ok to take the mod here - hence the 'false' flag
    await Promise.all(oldCommitments.map(commitment => commitment.index)),
  ].flat(Infinity);

  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  // This is (so far) the only place where we need to get specific about the
  // circuit
  let folderpath;
  let transactionType;
  if (oldCommitments.length === 1) {
    folderpath = 'single_transfer';
    transactionType = 1;
  } else if (oldCommitments.length === 2) {
    folderpath = 'double_transfer';
    transactionType = 2;
  } else throw new Error('Unsupported number of commitments');
  if (USE_STUBS) folderpath = `${folderpath}_stub`;
  const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
    folderpath,
    inputs: await witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });
  logger.silly(`Received response ${JSON.stringify(res.data, null, 2)}`);
  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const optimisticTransferTransaction = new Transaction({
    fee,
    transactionType,
    publicInputs,
    ercAddress,
    commitments: newCommitments,
    nullifiers,
    historicRoot: root,
    proof,
  });
  try {
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(optimisticTransferTransaction)
      .encodeABI();
    // store the commitment on successful computation of the transaction
    newCommitments.map(commitment => storeCommitment(commitment)); // TODO insertMany
    // mark the old commitments as nullified
    oldCommitments.map(commitment => markNullified(commitment));

    return { rawTransaction, transaction: optimisticTransferTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default transfer;
