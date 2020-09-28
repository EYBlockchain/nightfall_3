/**
 This module contains the logic needed create a zkp deposit, i.e. to pay
 a token to the Shield contract and have it create a zkp commitment for the
 same value.
 * @module deposit.mjs
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import { generalise } from '../utils/general-number/general-number.mjs';
import { sha256 } from '../utils/crypto/sha256.mjs';
import rand from '../utils/crypto/crypto-random';
import { getWeb3ContractInstance } from '../utils/contract-utils.mjs';

const { ZKP_KEY_LENGTH, ZOKRATES_WORKER_URL } = config;

async function deposit(items) {
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { ercAddress, value, zkpPublicKey } = generalise(items);
  // we also need a salt to make the commitment unique and increase its entropy
  const salt = await rand(ZKP_KEY_LENGTH);
  // next, let's compute the zkp commitment we're going to store and the hash of the public inputs
  const commitment = sha256([ercAddress, value, zkpPublicKey, salt]);
  const publicInputHash = sha256([ercAddress, value, commitment]);
  // now we can compute a Witness so that we can generate the proof
  const witness = [publicInputHash, ercAddress, value, salt, commitment];
  // call a zokrates worker to generate the proof
  const { proof } = await axios.post(`${ZOKRATES_WORKER_URL}/generate-proof`, {
    folderpath: 'deposit',
    inputs: witness.all.limbs(256, 2),
    provingScheme: 'gm17',
    backend: 'libsnark',
  });
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const shieldContractInstance = getWeb3ContractInstance('shield');
  return shieldContractInstance.methods
    .deposit(
      Object.values(proof),
      publicInputHash.hex(32),
      ercAddress.hex(32),
      value.hex(32),
      commitment.hex(32),
    )
    .encodeABI();
}

export default deposit;
