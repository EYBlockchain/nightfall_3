// ignore unused exports default

/**
 This module contains the logic needed create a zkp deposit, i.e. to pay
 a token to the Shield contract and have it create a zkp commitment for the
 same value. It is agnostic to whether we are dealing with an ERC20 or ERC721
 (or ERC1155).
 * @module deposit
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import config from 'config';
import gen from 'general-number';
import { initialize } from 'zokrates-js';

import rand from '../../common-files/utils/crypto/crypto-random';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
// import { generateProof, computeWitness } from 'zokrates-js';
import { Commitment, PublicInputs, Transaction } from '../classes/index';
import { storeCommitment } from './commitment-storage';
import { compressPublicKey } from './keys';

// eslint-disable-next-line
import abi from '../../zokrates/deposit_stub/artifacts/deposit_stub-abi.json';
// eslint-disable-next-line
import programFile from '../../zokrates/deposit_stub/artifacts/deposit_stub-program';
// eslint-disable-next-line
import pkFile from '../../zokrates/deposit_stub/keypair/deposit_stub-pk';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

const { ZKP_KEY_LENGTH, SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = config;
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
    ercAddress.integer,
    tokenId.integer,
    value.integer,
    compressedPkd.limbs(32, 8),
    salt.limbs(32, 8),
    commitment.hash.integer,
  ];
  logger.debug(`witness input is ${witnessInput.join(' ')}`);
  // call a zokrates worker to generate the proof
  // let folderpath = 'deposit';
  // eslint-disable-next-line no-unused-vars
  // if (USE_STUBS) folderpath = `${folderpath}_stub`;

  const zokratesProvider = await initialize();
  const program = await fetch(programFile)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);
  const pk = await fetch(pkFile)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);

  const artifacts = { program: new Uint8Array(program), abi: JSON.stringify(abi) };
  const keypair = { pk: new Uint8Array(pk) };

  // computation
  const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
  // generate proof
  const { proof } = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
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
