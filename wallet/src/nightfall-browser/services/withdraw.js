/* ignore unused exports */

/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import gen from 'general-number';
import { initialize } from 'zokrates-js';
import * as snarkjs from 'snarkjs';
import confirmBlock from './confirm-block';
import computeCircuitInputs from '../utils/compute-witness';
import getCommitmentInfo from '../utils/getCommitmentInfo';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Transaction } from '../classes/index';
import { checkIndexDBForCircuit, getStoreCircuit, getLatestTree, getMaxBlock } from './database';
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
  } = generalise(withdrawParams);

  const ercAddress = generalise(withdrawParams.ercAddress.toLowerCase());

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
    maxNumberNullifiers: VK_IDS.withdraw.numberNullifiers,
    providedCommitments,
  });

  try {
    // now we have everything  we need to create a Witness and compute a proof
    const transaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 2,
      tokenType: withdrawParams.tokenType,
      tokenId,
      value,
      ercAddress,
      recipientAddress,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      numberNullifiers: VK_IDS.withdraw.numberNullifiers,
      numberCommitments: VK_IDS.withdraw.numberCommitments,
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

    const witnessInput = computeCircuitInputs(
      transaction,
      privateData,
      commitmentsInfo.roots,
      maticAddress,
      VK_IDS.withdraw.numberNullifiers,
      VK_IDS.withdraw.numberCommitments,
    );

    // call a zokrates worker to generate the proof
    const zokratesProvider = await initialize();
    const artifacts = {
      program: new Uint8Array(program),
      abi: { inputs: abi.inputs, outputs: [abi.output] },
    };
    const keypair = { pk: new Uint8Array(pk) };
    // computation
    const witnessInfo = zokratesProvider.computeWitness(artifacts, witnessInput, { snarkjs: true });
    // generate proof
    const prove = await snarkjs.groth16.prove(keypair, witnessInfo.snarkjs.witness); // zkey, witness
    const { proof } = prove;
    // and work out the ABI encoded data that the caller should sign and send to the shield contract

    const optimisticWithdrawTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 2,
      tokenType: withdrawParams.tokenType,
      tokenId,
      value,
      ercAddress,
      recipientAddress,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      proof,
      numberNullifiers: VK_IDS.withdraw.numberNullifiers,
      numberCommitments: VK_IDS.withdraw.numberCommitments,
    });
    try {
      const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(optimisticWithdrawTransaction))
        .encodeABI();

      // Store new commitments that are ours.
      const storeNewCommitments = commitmentsInfo.newCommitments
        .filter(c => c.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32))
        .map(c => storeCommitment(c, nullifierKey));

      const nullifyOldCommitments = commitmentsInfo.oldCommitments.map(c =>
        markNullified(c, optimisticWithdrawTransaction),
      );

      await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);

      return {
        rawTransaction,
        transaction: optimisticWithdrawTransaction,
      };
    } catch (err) {
      await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
      throw new Error(err);
    }
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
