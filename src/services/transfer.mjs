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
import { findUsableCommitments } from './commitment-storage.mjs';
import Nullifier from '../classes/nullifier.mjs';
import Commitment from '../classes/commitment.mjs';
import PublicInputs from '../classes/public-inputs.mjs';
import { getSiblingPath, getLeafIndex } from '../utils/timber.mjs';

const {
  BN128_PRIME,
  ZKP_KEY_LENGTH,
  ZOKRATES_WORKER_URL,
  SHIELD_CONTRACT_NAME,
  COMMITMENTS_COLLECTION,
  MONGO_URL,
  COMMITMENTS_DB,
} = config;
const { generalise, GN } = gen;

async function transfer(items) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { ercAddress, tokenId, recipientData, senderZkpPrivateKey } = generalise(items);
  const senderZkpPublicKey = sha256([senderZkpPrivateKey]);
  const { recipientZkpPublicKeys, values } = recipientData;
  if (recipientZkpPublicKeys.length > 1)
    throw new Error('Batching is not supported yet: only one recipient is allowed'); // this will not always be true so we try to make the following code agnostic to the number of commitments

  // the first thing we need to do is to find some input commitments which
  // will enable us to conduct our transfer.  Let's rummage in the db...
  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  const commitments = await findUsableCommitments(
    senderZkpPublicKey,
    ercAddress,
    tokenId,
    totalValueToSend,
  );
  if (commitments) logger.debug(`Found commitments ${JSON.stringify(commitments, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments
  // Having found either 1 or 2 commitments, which are suitable inputs to the
  // proof, the next step is to compute their nullifiers;
  const nullifiers = commitments.map(commitment => new Nullifier(commitment, senderZkpPrivateKey));
  // then the new output commitment(s)
  const totalInputCommitmentValue = commitments.reduce(
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
  const outputCommitments = [];
  for (let i = 0; i < recipientZkpPublicKeys.length; i++) {
    outputCommitments.push(
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
      commitments.map(async commitment => {
        console.log('index direct', await getLeafIndex(commitment.hash.hex(32)));
        console.log('index', await commitment.index());
        return getSiblingPath(await commitment.index());
      }),
    ),
  );
  logger.silly(`SiblingPaths were: ${siblingPaths}`);
  const root = new GN(siblingPaths[0][0]);
  // and finally, the publicInput hash
  /*
  struct OldCommitment {
	u32[8] ercAddress
	u32[8] id
	u32[8] value
	u32[8] salt
	u32[8] hash
}

struct NewCommitment {
	u32[8] publicKeyRecipient
	u32[8] value
	u32[8] salt
	u32[8] hash
}

struct Nullifier {
	u32[8] privateKeySender
	u32[8] hash
}

def main(\
	field publicInputsHash,\
	private OldCommitment[2] oldCommitment,\
	private NewCommitment[2] newCommitment,\
	private Nullifier[2] nullifier,\
	private field[2][32] path,\
	private field[2] order,\
	private field root\
)->():
*/
  const publicInputs = new PublicInputs([
    commitments.map(commitment => commitment.hash),
    outputCommitments.map(commitment => commitment.hash),
    nullifiers.map(nullifier => nullifier.hash),
    root,
  ]);

  // now we have everything we need to create a Witness and compute a proof
  const witness = [
    publicInputs.hash.decimal, // TODO safer to make this a prime field??
    commitments.map(commitment => [
      commitment.preimage.ercAddress.limbs(32, 8),
      commitment.preimage.id.limbs(32, 8),
      commitment.preimage.value.limbs(32, 8),
      commitment.preimage.salt.limbs(32, 8),
      commitment.hash.limbs(32, 8),
    ]),
    outputCommitments.map(commitment => [
      commitment.preimage.zkpPublicKey.limbs(32, 8),
      commitment.preimage.value.limbs(32, 8),
      commitment.preimage.salt.limbs(32, 8),
      commitment.hash.limbs(32, 8),
    ]),
    nullifiers.map(nullifier => [
      nullifier.preimage.zkpPrivateKey.limbs(32, 8),
      nullifier.preimage.salt.limbs(32, 8),
    ]),
    siblingPaths.map(path => path.field(BN128_PRIME)),
    commitments.map(commitment => commitment.index.field(BN128_PRIME)),
    root,
  ].flat(Infinity);
  console.log('witness', witness);
}

export default transfer;
