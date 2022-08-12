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
import confirmBlock from './confirm-block';
import computeCircuitInputs from '../utils/compute-witness';
import getCommitmentInfo from '../utils/getCommitmentInfo';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Transaction } from '../classes/index';
import { checkIndexDBForCircuit, getStoreCircuit, getLatestTree, getMaxBlock } from './database';
import { ZkpKeys } from './keys';
import { clearPending, markNullified, storeCommitment } from './commitment-storage';

const { USE_STUBS } = global.config;
const { SHIELD_CONTRACT_NAME } = global.nightfallConstants;
const { generalise } = gen;
const circuitName = USE_STUBS ? 'withdraw_stub' : 'withdraw';

const MAX_WITHDRAW = 5192296858534827628530496329220096n; // 2n**112n

const NULL_COMMITMENT_INFO = {
  oldCommitments: [],
  nullifiers: [],
  newCommitments: [],
  localSiblingPaths: [],
  leafIndices: [],
  blockNumberL2s: [],
  roots: [],
  salts: [],
};

async function withdraw(withdrawParams, shieldContractAddress) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const {
    ercAddress,
    tokenId,
    value,
    recipientAddress,
    rootKey,
    fee = generalise(0),
  } = generalise(withdrawParams);

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

  const addedFee = maticAddress.hex(32) === ercAddress.hex(32) ? fee.bigInt : 0n;

  const withdrawValue = value.bigInt > MAX_WITHDRAW ? MAX_WITHDRAW : value;

  const commitmentsInfo = await getCommitmentInfo({
    transferValue: withdrawValue.bigInt,
    addedFee,
    ercAddress,
    tokenId,
    rootKey,
  });

  const commitmentsInfoFee =
    fee.bigInt === 0n || commitmentsInfo.feeIncluded
      ? NULL_COMMITMENT_INFO
      : await getCommitmentInfo({
          transferValue: fee.bigInt,
          ercAddress: maticAddress,
          rootKey,
        }).catch(async () => {
          await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
          throw new Error('Failed getting fee commitments');
        });

  try {
    // now we have everything  we need to create a Witness and compute a proof
    const transaction = new Transaction({
      fee,
      historicRootBlockNumberL2: [
        ...commitmentsInfo.blockNumberL2s,
        ...commitmentsInfoFee.blockNumberL2s,
      ],
      transactionType: 2,
      tokenType: withdrawParams.tokenType,
      tokenId,
      value,
      ercAddress,
      recipientAddress,
      commitments: [...commitmentsInfo.newCommitments, ...commitmentsInfoFee.newCommitments],
      nullifiers: [...commitmentsInfo.nullifiers, ...commitmentsInfoFee.nullifiers],
    });

    const privateData = {
      rootKey: [rootKey, rootKey, rootKey, rootKey],
      oldCommitmentPreimage: [
        ...commitmentsInfo.oldCommitments,
        ...commitmentsInfoFee.oldCommitments,
      ].map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      paths: [...commitmentsInfo.localSiblingPaths, ...commitmentsInfoFee.localSiblingPaths].map(
        siblingPath => siblingPath.slice(1),
      ),
      orders: [...commitmentsInfo.leafIndices, ...commitmentsInfoFee.leafIndices],
      newCommitmentPreimage: [
        ...commitmentsInfo.newCommitments,
        ...commitmentsInfoFee.newCommitments,
      ].map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      recipientPublicKeys: [
        ...commitmentsInfo.newCommitments,
        ...commitmentsInfoFee.newCommitments,
      ].map(o => o.preimage.zkpPublicKey),
      ercAddress,
      tokenId,
    };

    const witnessInput = computeCircuitInputs(
      transaction,
      privateData,
      [...commitmentsInfo.roots, ...commitmentsInfoFee.roots],
      maticAddress,
    );

    // call a zokrates worker to generate the proof
    const zokratesProvider = await initialize();
    const artifacts = { program: new Uint8Array(program), abi };
    const keypair = { pk: new Uint8Array(pk) };
    // computation
    const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
    // generate proof
    let { proof } = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
    proof = [...proof.a, ...proof.b, ...proof.c];
    proof = proof.flat(Infinity);
    // and work out the ABI encoded data that the caller should sign and send to the shield contract

    const optimisticWithdrawTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: [
        ...commitmentsInfo.blockNumberL2s,
        ...commitmentsInfoFee.blockNumberL2s,
      ],
      transactionType: 2,
      tokenType: withdrawParams.tokenType,
      tokenId,
      value,
      ercAddress,
      recipientAddress,
      commitments: [...commitmentsInfo.newCommitments, ...commitmentsInfoFee.newCommitments],
      nullifiers: [...commitmentsInfo.nullifiers, ...commitmentsInfoFee.nullifiers],
      proof,
    });
    try {
      const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(optimisticWithdrawTransaction))
        .encodeABI();

      // Store new commitments that are ours.
      const storeNewCommitments = [
        ...commitmentsInfo.newCommitments,
        ...commitmentsInfoFee.newCommitments,
      ]
        .filter(c => c.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32))
        .map(c => storeCommitment(c, nullifierKey));
      const nullifyOldCommitments = [
        ...commitmentsInfo.oldCommitments,
        ...commitmentsInfoFee.oldCommitments,
      ].map(c => markNullified(c, optimisticWithdrawTransaction));
      await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);

      return {
        rawTransaction,
        transaction: optimisticWithdrawTransaction,
      };
    } catch (err) {
      await Promise.all(
        [...commitmentsInfo.oldCommitments, ...commitmentsInfoFee.oldCommitments].map(commitment =>
          clearPending(commitment),
        ),
      );
      throw new Error(err);
    }
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
