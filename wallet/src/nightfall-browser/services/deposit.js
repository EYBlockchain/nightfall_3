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
import getCommitmentInfo from '@Nightfall/utils/getCommitmentInfo';
import * as snarkjs from 'snarkjs';
import confirmBlock from './confirm-block';
import { randValueLT } from '../../common-files/utils/crypto/crypto-random';
import { getContractInstance } from '../../common-files/utils/contract';
import { compressProof } from '../../common-files/utils/curve-maths/curves';
import logger from '../../common-files/utils/logger';
import { Commitment, Transaction } from '../classes/index';
import { storeCommitment } from './commitment-storage';
import { ZkpKeys } from './keys';
import { checkIndexDBForCircuit, getLatestTree, getMaxBlock, getStoreCircuit } from './database';

const { VK_IDS } = global.config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = global.nightfallConstants;
const { generalise } = gen;
let circuitName = 'depositfee';

async function deposit(depositParams, shieldContractAddress) {
  logger.info('Creating a deposit transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { tokenType, providedCommitmentsFee, ...items } = depositParams;
  const ercAddress = generalise(depositParams.ercAddress.toLowerCase());
  const { tokenId, value, fee, rootKey } = generalise(items);
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);
  const zkpPublicKey = ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey);

  const shieldContractInstance = await getContractInstance(
    SHIELD_CONTRACT_NAME,
    shieldContractAddress,
  );

  const feeL2TokenAddress = generalise(
    (await shieldContractInstance.methods.getFeeL2TokenAddress().call()).toLowerCase(),
  );

  let valueNewCommitment = value;

  let commitmentsInfo = {
    oldCommitments: [],
    nullifiers: [],
    newCommitments: [],
    localSiblingPaths: [],
    leafIndices: [],
    blockNumberL2s: [],
    roots: [],
    salts: [],
  };

  if (fee.bigInt > 0) {
    if (feeL2TokenAddress.hex(32) === ercAddress.hex(32)) {
      if (value.bigInt < fee.bigInt) {
        throw new Error('Value deposited needs to be bigger than the fee');
      }
      valueNewCommitment = generalise(value.bigInt - fee.bigInt);
      circuitName = 'deposit';
    } else {
      commitmentsInfo = await getCommitmentInfo({
        totalValueToSend: 0n,
        fee,
        ercAddress,
        feeL2TokenAddress,
        rootKey,
        maxNullifiers: VK_IDS[circuitName].numberNullifiers,
        maxNonFeeNullifiers: 0,
        providedCommitmentsFee,
      });
    }
  } else {
    circuitName = 'deposit';
  }

  const lastTree = await getLatestTree();
  const lastBlockNumber = await getMaxBlock();

  await confirmBlock(lastBlockNumber, lastTree);

  const circuitHashData = await getStoreCircuit(`${circuitName}-hash`);
  const circuitHash = generalise(circuitHashData.data).hex(32);

  const salt = await randValueLT(BN128_GROUP_ORDER);
  const commitment = new Commitment({
    ercAddress,
    tokenId,
    value: valueNewCommitment,
    zkpPublicKey,
    salt,
  });
  logger.debug(`Hash of new commitment is ${commitment.hash.hex()}`);

  // Mark the commitment as deposited
  commitment.isDeposited = true;

  // Prepend the new tokenised commitment
  commitmentsInfo.newCommitments = [commitment, ...commitmentsInfo.newCommitments];

  // now we can compute a Witness so that we can generate the proof
  const publicData = new Transaction({
    fee,
    historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
    circuitHash,
    tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: commitmentsInfo.newCommitments,
    nullifiers: commitmentsInfo.nullifiers,
    numberNullifiers: VK_IDS[circuitName].numberNullifiers,
    numberCommitments: VK_IDS[circuitName].numberCommitments,
    isOnlyL2: false,
  });

  const privateData = {
    rootKey,
    oldCommitmentPreimage: commitmentsInfo.oldCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    paths: commitmentsInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
    orders: commitmentsInfo.leafIndices,
    newCommitmentPreimage: commitmentsInfo.newCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    recipientPublicKeys: commitmentsInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
  };

  const witness = computeCircuitInputs(
    publicData,
    privateData,
    commitmentsInfo.roots,
    feeL2TokenAddress,
    VK_IDS[circuitName].numberNullifiers,
    VK_IDS[circuitName].numberCommitments,
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
    const transaction = { ...publicData, proof: compressProof(proof) };
    transaction.transactionHash = Transaction.calcHash(transaction);
    logger.trace(`Optimistic deposit transaction ${JSON.stringify(transaction, null, 2)}`);
    // and then we can create an unsigned blockchain transaction
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(transaction))
      .encodeABI();
    await storeCommitment(commitment, nullifierKey);

    return { rawTransaction, transaction };
  } catch (err) {
    console.log('ERR', err);
    throw new Error(err); // let the caller handle the error
  }
}

export default deposit;
