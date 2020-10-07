/**
 This module contains the logic needed create a zkp deposit, i.e. to pay
 a token to the Shield contract and have it create a zkp commitment for the
 same value. It is agnostic to whether we are dealing with an ERC20 or ERC721.
 * @module deposit.mjs
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import { generalise } from '../utils/general-number/general-number.mjs';
import { sha256 } from '../utils/crypto/sha256.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';

const { ZKP_KEY_LENGTH, ZOKRATES_WORKER_URL } = config;

async function deposit(items) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { ercAddress, tokenId, value, zkpPublicKey } = generalise(items);
  // we also need a salt to make the commitment unique and increase its entropy
  const salt = await rand(ZKP_KEY_LENGTH);
  // next, let's compute the zkp commitment we're going to store and the hash of the public inputs
  const commitment = sha256([ercAddress, tokenId, value, zkpPublicKey, salt]);
  const publicInputHash = sha256([ercAddress, tokenId, value, commitment]);
  // now we can compute a Witness so that we can generate the proof
  const witness = [
    publicInputHash.limbs(248, 1),
    ercAddress.limbs(32),
    tokenId.limbs(32),
    value.limbs(32),
    salt.limbs(32),
    commitment.limbs(32),
  ].flat(Infinity);
  logger.debug(`witness computed as ${witness}`);
  // call a zokrates worker to generate the proof
  const { proof } = await axios.post(`${ZOKRATES_WORKER_URL}/generate-proof`, {
    folderpath: 'deposit',
    inputs: witness,
    provingScheme: 'gm17',
    backend: 'libsnark',
  });
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const shieldContractInstance = getContractInstance('shield');
  return shieldContractInstance.methods
    .deposit(
      publicInputHash.limbs(248, 1, 'hex'),
      ercAddress.hex(32),
      tokenId.hex(32),
      value.hex(32),
      commitment.hex(32),
      Object.values(proof).flat(Infinity),
    )
    .encodeABI();
}

export default deposit;
