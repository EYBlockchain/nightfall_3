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
import { getContractInstance } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';
import { findUsableCommitments, markNullified } from './commitment-storage.mjs';
import Nullifier from '../classes/nullifier.mjs';
import PublicInputs from '../classes/public-inputs.mjs';
import { getSiblingPath } from '../utils/timber.mjs';
import Transaction from '../classes/transaction.mjs';
import { discoverPeers } from './peers.mjs';

const {
  BN128_GROUP_ORDER,
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  SHIELD_CONTRACT_NAME,
  PROTOCOL,
  USE_STUBS,
} = config;
const { generalise } = gen;

async function withdraw(transferParams) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const { offchain = false, ...items } = transferParams;
  const { ercAddress, tokenId, value, recipientAddress, senderZkpPrivateKey, fee } = generalise(
    items,
  );
  const senderZkpPublicKey = sha256([senderZkpPrivateKey]);

  // the first thing we need to do is to find and input commitment which
  // will enable us to conduct our withdraw.  Let's rummage in the db...
  const [oldCommitment] = (await findUsableCommitments(
    senderZkpPublicKey,
    ercAddress,
    tokenId,
    value,
    true,
  )) || [null];
  if (oldCommitment) logger.debug(`Found commitment ${JSON.stringify(oldCommitment, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  // Having found 1 commitment, which is a suitable input to the
  // proof, the next step is to compute its nullifier;
  const nullifier = new Nullifier(oldCommitment, senderZkpPrivateKey);
  // and the Merkle path from the commitment to the root
  const siblingPath = generalise(await getSiblingPath(await oldCommitment.index));
  logger.silly(`SiblingPath was: ${JSON.stringify(siblingPath)}`);
  // public inputs
  const root = siblingPath[0];
  console.log('public inputs', [
    oldCommitment.preimage.ercAddress,
    oldCommitment.preimage.tokenId,
    oldCommitment.preimage.value,
    nullifier.hash,
    recipientAddress,
    root,
  ]);
  const publicInputs = new PublicInputs([
    oldCommitment.preimage.ercAddress,
    oldCommitment.preimage.tokenId,
    oldCommitment.preimage.value,
    nullifier.hash,
    recipientAddress,
    root,
  ]);

  // now we have everything we need to create a Witness and compute a proof
  const witness = [
    publicInputs.hash.decimal, // TODO safer to make this a prime field??
    oldCommitment.preimage.ercAddress.limbs(32, 8),
    oldCommitment.preimage.tokenId.limbs(32, 8),
    oldCommitment.preimage.value.limbs(32, 8),
    oldCommitment.preimage.salt.limbs(32, 8),
    oldCommitment.hash.limbs(32, 8),
    nullifier.preimage.zkpPrivateKey.limbs(32, 8),
    nullifier.hash.limbs(32, 8),
    recipientAddress.field(BN128_GROUP_ORDER),
    siblingPath.map(node => node.field(BN128_GROUP_ORDER, false)), // siblingPAth[32] is a sha hash and will overflow a field but it's ok to take the mod here - hence the 'false' flag
    await oldCommitment.index,
  ].flat(Infinity);

  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  let folderpath = 'withdraw';
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
  const optimisticWithdrawTransaction = new Transaction({
    fee,
    transactionType: 3,
    publicInputs,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    nullifiers: [nullifier],
    historicRoot: root,
    proof,
  });
  try {
    if (offchain) {
      const peerList = await discoverPeers('Local');
      Object.keys(peerList).forEach(async address => {
        await axios
          .post(
            `${peerList[address]}/proposer/transfer`,
            { transaction: optimisticWithdrawTransaction },
            { timeout: 3600000 },
          )
          .catch(err => {
            throw new Error(err);
          });
      });
      markNullified(oldCommitment);
      optimisticWithdrawTransaction.transactionHash = th;
      return { transaction: optimisticWithdrawTransaction };
    }
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticWithdrawTransaction))
      .encodeABI();
    // on successful computation of the transaction mark the old commitments as nullified
    markNullified(oldCommitment);
    return { rawTransaction, transaction: optimisticWithdrawTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
