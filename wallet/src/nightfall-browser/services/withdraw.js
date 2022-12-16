/* ignore unused exports */

/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import gen from 'general-number';
import * as snarkjs from 'snarkjs';
import confirmBlock from './confirm-block';
import computeCircuitInputs from '../utils/computeCircuitInputs';
import getCommitmentInfo from '../utils/getCommitmentInfo';
import { getContractInstance } from '../../common-files/utils/contract';
import { compressProof } from '../../common-files/utils/curve-maths/curves';
import logger from '../../common-files/utils/logger';
import { Transaction } from '../classes/index';
import { checkIndexDBForCircuit, getLatestTree, getMaxBlock, getStoreCircuit } from './database';
import { ZkpKeys } from './keys';
import { clearPending, markNullified, storeCommitment } from './commitment-storage';

const { VK_IDS } = global.config;
const { SHIELD_CONTRACT_NAME } = global.nightfallConstants;
const { generalise } = gen;
const circuitName = 'withdraw';

const MAX_WITHDRAW = 5192296858534827628530496329220096n; // 2n**112n

async function withdraw(withdrawParams, shieldContractAddress) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const {
    tokenId,
    value,
    recipientAddress,
    rootKey,
    fee = generalise(0),
    providedCommitments,
    providedCommitmentsFee,
  } = generalise(withdrawParams);
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);
  const ercAddress = generalise(withdrawParams.ercAddress.toLowerCase());

  const lastTree = await getLatestTree();
  const lastBlockNumber = await getMaxBlock();

  await confirmBlock(lastBlockNumber, lastTree);

  const shieldContractInstance = await getContractInstance(
    SHIELD_CONTRACT_NAME,
    shieldContractAddress,
  );

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const withdrawValue = value.bigInt > MAX_WITHDRAW ? MAX_WITHDRAW : value.bigInt;

  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend: withdrawValue,
    fee: fee.bigInt,
    ercAddress,
    maticAddress,
    tokenId,
    rootKey,
    maxNullifiers: VK_IDS[circuitName].numberNullifiers,
    providedCommitments,
    providedCommitmentsFee,
  });

  const circuitHashData = await getStoreCircuit(`${circuitName}-hash`);

  const circuitHash = circuitHashData.data;

  try {
    // now we have everything  we need to create a Witness and compute a proof
    const publicData = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      circuitHash,
      tokenType: withdrawParams.tokenType,
      tokenId,
      value,
      ercAddress,
      recipientAddress,
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
      maticAddress,
      VK_IDS[circuitName].numberNullifiers,
      VK_IDS[circuitName].numberCommitments,
    );

    if (!(await checkIndexDBForCircuit(circuitName)))
      throw Error('Some circuit data are missing from IndexedDB');
    const [wasmData, zkeyData] = await Promise.all([
      getStoreCircuit(`${circuitName}-wasm`),
      getStoreCircuit(`${circuitName}-zkey`),
    ]);

    // generate proof
    const { proof } = await snarkjs.groth16.fullProve(witness, wasmData.data, zkeyData.data); // zkey, witness

    // and work out the ABI encoded data that the caller should sign and send to the shield contract
    const transaction = { ...publicData, proof: compressProof(proof) };
    transaction.transactionHash = Transaction.calcHash(transaction);
    try {
      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(transaction))
        .encodeABI();

      // Store new commitments that are ours.
      const storeNewCommitments = commitmentsInfo.newCommitments
        .filter(c => c.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32))
        .map(c => storeCommitment(c, nullifierKey));

      const nullifyOldCommitments = commitmentsInfo.oldCommitments.map(c =>
        markNullified(c, transaction),
      );

      await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);

      return { rawTransaction, transaction };
    } catch (err) {
      await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
      throw new Error(err);
    }
  } catch (err) {
    console.log('ERR', err);
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
