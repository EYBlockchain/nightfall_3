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
import { initialize } from 'zokrates-js';

import computeCircuitInputs from '@Nightfall/utils/compute-witness';
import confirmBlock from './confirm-block';
import { randValueLT } from '../../common-files/utils/crypto/crypto-random';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Commitment, Transaction } from '../classes/index';
import { storeCommitment } from './commitment-storage';
import { ZkpKeys } from './keys';
import { checkIndexDBForCircuit, getStoreCircuit, getLatestTree, getMaxBlock } from './database';

const { USE_STUBS } = global.config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = global.nightfallConstants;
const { generalise } = gen;
const circuitName = USE_STUBS ? 'deposit_stub' : 'deposit';

async function deposit(items, shieldContractAddress) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { tokenId, value, compressedZkpPublicKey, nullifierKey, fee } = generalise(items);
  const ercAddress = generalise(items.ercAddress.toLowerCase());
  const zkpPublicKey = ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey);

  const shieldContractInstance = await getContractInstance(
    SHIELD_CONTRACT_NAME,
    shieldContractAddress,
  );

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  if (!(await checkIndexDBForCircuit(circuitName)))
    throw Error('Some circuit data are missing from IndexedDB');
  const [abiData, programData, pkData] = await Promise.all([
    getStoreCircuit(`${circuitName}-abi`),
    getStoreCircuit(`${circuitName}-program`),
    getStoreCircuit(`${circuitName}-pk`),
  ]);

  const lastTree = await getLatestTree();
  const lastBlockNumber = await getMaxBlock();

  await confirmBlock(lastBlockNumber, lastTree);

  const abi = abiData.data;
  const program = programData.data;
  const pk = pkData.data;

  const salt = await randValueLT(BN128_GROUP_ORDER);
  const commitment = new Commitment({ ercAddress, tokenId, value, zkpPublicKey, salt });
  logger.debug(`Hash of new commitment is ${commitment.hash.hex()}`);
  // now we can compute a Witness so that we can generate the proof
  const publicData = new Transaction({
    fee,
    transactionType: 0,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: [commitment],
  });

  const privateData = { salt, recipientPublicKeys: [zkpPublicKey] };

  const witnessInput = computeCircuitInputs(publicData, privateData, [0, 0, 0, 0], maticAddress);

  try {
    const zokratesProvider = await initialize();
    const artifacts = { program: new Uint8Array(program), abi };
    const keypair = { pk: new Uint8Array(pk) };

    // computation
    console.log('Computing Witness');
    const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
    // generate proof
    console.log('Generate Proof');
    const { proof } = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
    const shieldContractInstance = await getContractInstance(
      SHIELD_CONTRACT_NAME,
      shieldContractAddress,
    );

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
    logger.trace(
      `Optimistic deposit transaction ${JSON.stringify(optimisticDepositTransaction, null, 2)}`,
    );
    // and then we can create an unsigned blockchain transaction
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticDepositTransaction))
      .encodeABI();

    // store the commitment on successful computation of the transaction
    commitment.isDeposited = true;
    await storeCommitment(commitment, nullifierKey);
    // await saveTransaction(optimisticDepositTransaction);
    return { rawTransaction, transaction: optimisticDepositTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default deposit;
