/**
 This module contains the logic needed create a zkp deposit, i.e. to pay
 a token to the Shield contract and have it create a zkp commitment for the
 same value. It is agnostic to whether we are dealing with an ERC20 or ERC721
 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import { sha256 } from '../utils/crypto/sha256.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';
import mongo from '../utils/mongo.mjs';

const {
  ZKP_KEY_LENGTH,
  ZOKRATES_WORKER_URL,
  SHIELD_CONTRACT_NAME,
  PROVING_SCHEME,
  BACKEND,
  MONGO_URL,
  COMMITMENTS_DB,
  COMMITMENTS_COLLECTION,
} = config;
const { generalise, GN } = gen;

async function deposit(items) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { ercAddress, tokenId, value, zkpPublicKey } = generalise(items);
  // we also need a salt to make the commitment unique and increase its entropy
  const salt = await rand(ZKP_KEY_LENGTH);
  // next, let's compute the zkp commitment we're going to store and the hash of the public inputs (truncated to 248 bits)
  const commitment = sha256([ercAddress, tokenId, value, zkpPublicKey, salt]);
  const publicInputHash = new GN(sha256([ercAddress, tokenId, value, commitment]).limbs(248, 2)[1]);
  // now we can compute a Witness so that we can generate the proof
  const witness = [
    publicInputHash.decimal,
    ercAddress.limbs(32, 8),
    tokenId.limbs(32, 8),
    value.limbs(32, 8),
    zkpPublicKey.limbs(32, 8),
    salt.limbs(32, 8),
    commitment.limbs(32, 8),
  ].flat(Infinity);
  logger.debug(`witness input is ${witness.join(' ')}`);
  logger.debug(`witness input length is ${witness.length}`);
  logger.silly(`publicInputhash is ${publicInputHash.hex()}`);
  logger.silly(`padded publicInputhash is ${publicInputHash.hex(32)}`);
  // call a zokrates worker to generate the proof
  const res = await axios.post(`${ZOKRATES_WORKER_URL}/generate-proof`, {
    folderpath: 'deposit',
    inputs: witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });
  logger.silly(`Received response ${JSON.stringify(res.data, null, 2)}`);
  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const rawTransaction = shieldContractInstance.methods
    .deposit(
      publicInputHash.hex(32),
      ercAddress.hex(32),
      tokenId.hex(32),
      value.hex(32),
      commitment.hex(32),
      Object.values(proof).flat(Infinity),
    )
    .encodeABI();
  // need to store this commitment, indexed by public commitment hash
  const data = {
    _id: commitment.hex(32),
    zkpPublicKey: zkpPublicKey.hex(32),
    ercAddress: ercAddress.hex(32),
    tokenId: tokenId.hex(32),
    value: value.decimal,
  };
  const connection = await mongo.connect(MONGO_URL);
  await Promise.all([connection, rawTransaction]);
  const db = connection.db(COMMITMENTS_DB);
  db.collection(COMMITMENTS_COLLECTION).insertOne(data);
  return rawTransaction;
}

export default deposit;
