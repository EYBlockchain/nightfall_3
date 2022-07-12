/**
 This module contains the logic needed create a zkp deposit, i.e. to pay
 a token to the Shield contract and have it create a zkp commitment for the
 same value. It is agnostic to whether we are dealing with an ERC20 or ERC721
 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import { Commitment, Transaction } from '../classes/index.mjs';
import { storeCommitment } from './commitment-storage.mjs';

const {
  ZKP_KEY_LENGTH,
  ZOKRATES_WORKER_HOST,
  SHIELD_CONTRACT_NAME,
  PROVING_SCHEME,
  BACKEND,
  PROTOCOL,
  USE_STUBS,
  BN128_GROUP_ORDER,
} = config;
const { generalise } = gen;

async function deposit(items) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { ercAddress, tokenId, value, compressedZkpPublicKey, nullifierKey, fee } =
    generalise(items);

  let commitment;
  let salt;
  do {
    // we also need a salt to make the commitment unique and increase its entropy
    // eslint-disable-next-line
    salt = await rand(ZKP_KEY_LENGTH);
    // next, let's compute the zkp commitment we're going to store
    commitment = new Commitment({ ercAddress, tokenId, value, compressedZkpPublicKey, salt });
  } while (commitment.hash.bigInt > BN128_GROUP_ORDER);

  logger.debug(`Hash of new commitment is ${commitment.hash.hex()}`);
  // now we can compute a Witness so that we can generate the proof
  const witness = [
    ercAddress.integer,
    tokenId.integer,
    value.integer,
    compressedZkpPublicKey.limbs(32, 8),
    salt.limbs(32, 8),
    commitment.hash.integer, // not truncating here as we already ensured hash < group order
  ].flat(Infinity);
  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  let folderpath = 'deposit';
  if (USE_STUBS) folderpath = `${folderpath}_stub`;
  const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
    folderpath,
    inputs: witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });
  logger.silly(`Received response ${JSON.stringify(res.data, null, 2)}`);
  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  // first, get the contract instance
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);

  // next we need to compute the optimistic Transaction object
  const optimisticDepositTransaction = new Transaction({
    fee,
    transactionType: 0,
    tokenType: items.tokenType,
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
    storeCommitment(commitment, nullifierKey);
    return { rawTransaction, transaction: optimisticDepositTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default deposit;
