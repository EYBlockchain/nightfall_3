/**
 This module contains the logic needed create a zkp deposit, i.e. to pay
 a token to the Shield contract and have it create a zkp commitment for the
 same value. It is agnostic to whether we are dealing with an ERC20 or ERC721
 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import gen from 'general-number';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import { generateProof, computeWitness } from 'zokrates-js';
import { Commitment, PublicInputs, Transaction } from '../classes/index.mjs';
import { storeCommitment } from './commitment-storage.mjs';
import { compressPublicKey } from './keys.mjs';

const { ZKP_KEY_LENGTH, SHIELD_CONTRACT_NAME, USE_STUBS, BN128_GROUP_ORDER } = config;
const { generalise } = gen;

async function deposit(items) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { ercAddress, tokenId, value, pkd, nsk, fee } = generalise(items);
  const compressedPkd = compressPublicKey(pkd);

  let commitment;
  let salt;
  do {
    // we also need a salt to make the commitment unique and increase its entropy
    // eslint-disable-next-line
    salt = await rand(ZKP_KEY_LENGTH);
    // next, let's compute the zkp commitment we're going to store and the hash of the public inputs (truncated to 248 bits)
    commitment = new Commitment({ ercAddress, tokenId, value, compressedPkd, salt });
  } while (commitment.hash.bigInt > BN128_GROUP_ORDER);

  const publicInputs = new PublicInputs([ercAddress, tokenId, value, commitment.hash]);
  logger.debug(`Hash of new commitment is ${commitment.hash.hex()}`);
  // now we can compute a Witness so that we can generate the proof
  const witnessInput = [
    publicInputs.hash.decimal,
    ercAddress.limbs(32, 8),
    tokenId.limbs(32, 8),
    value.limbs(32, 8),
    compressedPkd.limbs(32, 8),
    salt.limbs(32, 8),
    commitment.hash.limbs(32, 8),
  ].flat(Infinity);
  logger.debug(`witness input is ${witnessInput.join(' ')}`);
  // call a zokrates worker to generate the proof
  let folderpath = 'deposit';
  // eslint-disable-next-line no-unused-vars
  if (USE_STUBS) folderpath = `${folderpath}_stub`;
  let artifacts;
  let keypair;
  const { witness } = computeWitness(artifacts, witnessInput);
  const proof = generateProof(artifacts.program, witness, keypair.pk);
  // await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
  //   folderpath,
  //   inputs: witness,
  //   provingScheme: PROVING_SCHEME,
  //   backend: BACKEND,
  // }); // Replace with Zokrates JS
  // logger.silly(`Received response ${JSON.stringify(res.data, null, 2)}`);
  // const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  // first, get the contract instance
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);

  // next we need to compute the optimistic Transaction object
  const optimisticDepositTransaction = new Transaction({
    fee,
    transactionType: 0,
    tokenType: items.tokenType,
    publicInputs,
    tokenId,
    value,
    ercAddress,
    commitments: [commitment],
    proof,
  });
  logger.silly(
    `Optimistic deposit transaction ${JSON.stringify(optimisticDepositTransaction, null, 2)}`,
  );
  // and then we can create an unsigned blockchain transaction
  try {
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticDepositTransaction))
      .encodeABI();
    // store the commitment on successful computation of the transaction
    commitment.isDeposited = true;
    storeCommitment(commitment, nsk);
    return { rawTransaction, transaction: optimisticDepositTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default deposit;
