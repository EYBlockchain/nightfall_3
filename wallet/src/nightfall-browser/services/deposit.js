// ignore unused exports default

/**
 This module contains the logic needed create a zkp deposit, i.e. to pay
 a token to the Shield contract and have it create a zkp commitment for the
 same value. It is agnostic to whether we are dealing with an ERC20 or ERC721
 (or ERC1155).
 * @module deposit
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */

import gen from 'general-number';
import { wrap } from 'comlink';

import rand from '../../common-files/utils/crypto/crypto-random';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Commitment, Transaction } from '../classes/index';
import { storeCommitment } from './commitment-storage';
import { compressPublicKey } from './keys';
import { checkIndexDBForCircuit, getStoreCircuit } from './database';
import generateProofWorker from '../../web-worker/generateProof.shared-worker';

const generateProof = wrap(generateProofWorker().port);

const { ZKP_KEY_LENGTH, SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER, USE_STUBS } = global.config;
const { generalise } = gen;
const circuitName = USE_STUBS ? 'deposit_stub' : 'deposit';

async function deposit(items, shieldContractAddress) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { ercAddress, tokenId, value, pkd, nsk, fee } = generalise(items);
  const compressedPkd = compressPublicKey(pkd);

  if (!(await checkIndexDBForCircuit(circuitName)))
    throw Error('Some circuit data are missing from IndexedDB');
  const [abiData, programData, pkData] = await Promise.all([
    getStoreCircuit(`${circuitName}-abi`),
    getStoreCircuit(`${circuitName}-program`),
    getStoreCircuit(`${circuitName}-pk`),
  ]);

  const abi = abiData.data;
  const program = programData.data;
  const pk = pkData.data;

  let commitment;
  let salt;
  do {
    // we also need a salt to make the commitment unique and increase its entropy
    // eslint-disable-next-line
    salt = await rand(ZKP_KEY_LENGTH);
    // next, let's compute the zkp commitment we're going to store and the hash of the public inputs (truncated to 248 bits)
    commitment = new Commitment({ ercAddress, tokenId, value, compressedPkd, salt });
  } while (commitment.hash.bigInt > BN128_GROUP_ORDER);

  logger.debug(`Hash of new commitment is ${commitment.hash.hex()}`);
  // now we can compute a Witness so that we can generate the proof
  const witnessInput = [
    ercAddress.integer,
    tokenId.integer,
    value.integer,
    compressedPkd.limbs(32, 8),
    salt.limbs(32, 8),
    commitment.hash.integer,
  ];
  logger.debug(`witness input is ${witnessInput.join(' ')}`);

  const artifacts = { program: new Uint8Array(program), abi };
  const provingKey = new Uint8Array(pk);
  const { proof } = await generateProof(artifacts, witnessInput, provingKey);

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

  const shieldContractInstance = await getContractInstance(
    SHIELD_CONTRACT_NAME,
    shieldContractAddress,
  );

  // and then we can create an unsigned blockchain transaction
  try {
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticDepositTransaction))
      .encodeABI();

    // store the commitment on successful computation of the transaction
    commitment.isDeposited = true;
    await storeCommitment(commitment, nsk);
    // await saveTransaction(optimisticDepositTransaction);
    return { rawTransaction, transaction: optimisticDepositTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default deposit;
