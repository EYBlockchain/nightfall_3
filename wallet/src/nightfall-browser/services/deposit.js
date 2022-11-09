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
import computeCircuitInputs from '@Nightfall/utils/computeCircuitInputs';
import * as snarkjs from 'snarkjs';
import confirmBlock from './confirm-block';
import { randValueLT } from '../../common-files/utils/crypto/crypto-random';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Commitment, Transaction } from '../classes/index';
import { storeCommitment } from './commitment-storage';
import { ZkpKeys } from './keys';
import { checkIndexDBForCircuit, getLatestTree, getMaxBlock, getStoreCircuit } from './database';

const { VK_IDS } = global.config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = global.nightfallConstants;
const { generalise } = gen;
const circuitName = 'deposit';

async function deposit(items, shieldContractAddress) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { tokenId, value, compressedZkpPublicKey, nullifierKey } = generalise(items);
  const ercAddress = generalise(items.ercAddress.toLowerCase());
  const zkpPublicKey = ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey);

  const shieldContractInstance = await getContractInstance(
    SHIELD_CONTRACT_NAME,
    shieldContractAddress,
  );

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const lastTree = await getLatestTree();
  const lastBlockNumber = await getMaxBlock();

  await confirmBlock(lastBlockNumber, lastTree);

  const circuitHashData = await getStoreCircuit(`deposit-hash`);
  const circuitHash = circuitHashData.data;

  const salt = await randValueLT(BN128_GROUP_ORDER);
  const commitment = new Commitment({ ercAddress, tokenId, value, zkpPublicKey, salt });
  logger.debug(`Hash of new commitment is ${commitment.hash.hex()}`);
  // now we can compute a Witness so that we can generate the proof
  const publicData = new Transaction({
    fee: 0,
    circuitHash,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: [commitment],
    numberNullifiers: VK_IDS.deposit.numberNullifiers,
    numberCommitments: VK_IDS.deposit.numberCommitments,
    isOnlyL2: false,
  });

  const privateData = {
    newCommitmentPreimage: [{ value, salt }],
    recipientPublicKeys: [zkpPublicKey],
  };

  const witness = computeCircuitInputs(
    publicData,
    privateData,
    [],
    maticAddress,
    VK_IDS.deposit.numberNullifiers,
    VK_IDS.deposit.numberCommitments,
  );

  try {
    if (!(await checkIndexDBForCircuit(circuitName)))
      throw Error('Some circuit data are missing from IndexedDB');
    const [wasmData, zkeyData] = await Promise.all([
      getStoreCircuit(`${circuitName}-wasm`),
      getStoreCircuit(`${circuitName}-zkey`),
    ]);

    // generate proof
    const { proof } = await snarkjs.groth16.fullProve(witness, wasmData.data, zkeyData.data); // zkey, witness

    const shieldContractInstance = await getContractInstance(
      SHIELD_CONTRACT_NAME,
      shieldContractAddress,
    );

    // next we need to compute the optimistic Transaction object
    const optimisticDepositTransaction = new Transaction({
      fee: 0,
      circuitHash,
      tokenType: items.tokenType,
      tokenId,
      value,
      ercAddress,
      commitments: [commitment],
      proof,
      numberNullifiers: VK_IDS.deposit.numberNullifiers,
      numberCommitments: VK_IDS.deposit.numberCommitments,
      isOnlyL2: false,
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

    return { rawTransaction, transaction: optimisticDepositTransaction };
  } catch (err) {
    console.log('ERR', err);
    throw new Error(err); // let the caller handle the error
  }
}

export default deposit;
