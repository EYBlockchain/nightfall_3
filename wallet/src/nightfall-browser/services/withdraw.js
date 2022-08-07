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
import { getContractInstance } from '../../common-files/utils/contract';
import { randValueLT } from '../../common-files/utils/crypto/crypto-random';
import logger from '../../common-files/utils/logger';
import { Commitment, Nullifier, Transaction } from '../classes/index';
import {
  findUsableCommitmentsMutex,
  markNullified,
  clearPending,
  getSiblingInfo,
  storeCommitment,
} from './commitment-storage';
import { ZkpKeys } from './keys';
import { computeWitness } from '../utils/compute-witness';
import { checkIndexDBForCircuit, getStoreCircuit } from './database';

const { BN128_GROUP_ORDER, USE_STUBS } = global.config;
const { SHIELD_CONTRACT_NAME } = global.nightfallConstants;
const { generalise, GN } = gen;
const circuitName = USE_STUBS ? 'withdraw_stub' : 'withdraw';

const MAX_WITHDRAW = 5192296858534827628530496329220096n; // 2n**112n

async function withdraw(withdrawParams, shieldContractAddress) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const { ercAddress, tokenId, value, recipientAddress, rootKey, fee } = generalise(withdrawParams);
  const { compressedZkpPublicKey, nullifierKey, zkpPublicKey } = new ZkpKeys(rootKey);

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

  // the first thing we need to do is to find and input commitment which
  // will enable us to conduct our withdraw.  Let's rummage in the db...
  const oldCommitments = await findUsableCommitmentsMutex(
    compressedZkpPublicKey,
    ercAddress,
    tokenId,
    value,
    true,
  );
  if (oldCommitments) logger.debug(`Found commitment ${JSON.stringify(oldCommitments, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  try {
    // Having found 1 commitment, which is a suitable input to the
    // proof, the next step is to compute its nullifier;
    const nullifiers = oldCommitments.map(
      oldCommitment => new Nullifier(oldCommitment, nullifierKey),
    );
    // we may need to return change to the recipient
    const totalInputCommitmentValue = oldCommitments.reduce(
      (acc, curr) => curr.preimage.value.bigInt + acc,
      0n,
    );
    const withdrawValue = value.bigInt > MAX_WITHDRAW ? MAX_WITHDRAW : value.bigInt;
    const change = totalInputCommitmentValue - withdrawValue;
    // and the Merkle path from the commitment to the root
    const commitmentTreeInfo = await Promise.all(oldCommitments.map(c => getSiblingInfo(c)));
    const localSiblingPaths = commitmentTreeInfo.map(l => {
      const path = l.siblingPath.path.map(p => p.value);
      return generalise([l.root].concat(path.reverse()));
    });

    // public inputs
    const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
    const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);

    const newCommitment = [];
    const salt = await randValueLT(BN128_GROUP_ORDER);
    if (change !== 0n) {
      newCommitment.push(
        new Commitment({
          ercAddress,
          tokenId,
          value: new GN(change),
          zkpPublicKey,
          salt: salt.bigInt,
        }),
      );
    }
    // now we have everything we need to create a Witness and compute a proof
    const publicData = Transaction.buildSolidityStruct(
      new Transaction({
        fee,
        historicRootBlockNumberL2: blockNumberL2s,
        commitments: newCommitment.length > 0 ? newCommitment : [{ hash: 0 }, { hash: 0 }],
        transactionType: 2,
        tokenType: withdrawParams.tokenType,
        tokenId,
        value,
        ercAddress,
        recipientAddress,
        nullifiers,
      }),
    );
    const privateData = {
      rootKey: [rootKey, rootKey],
      oldCommitmentPreimage: oldCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      paths: localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
      orders: leafIndices,
      newCommitmentPreimage: newCommitment.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      recipientPublicKeys: newCommitment.map(o => o.preimage.zkpPublicKey),
    };

    const witnessInput = computeWitness(
      publicData,
      localSiblingPaths.map(siblingPath => siblingPath[0]),
      privateData,
    );

    logger.debug(`witness input is ${JSON.stringify(witnessInput)}`);
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
    const shieldContractInstance = await getContractInstance(
      SHIELD_CONTRACT_NAME,
      shieldContractAddress,
    );
    const optimisticWithdrawTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: blockNumberL2s,
      commitments: newCommitment.length > 0 ? newCommitment : [{ hash: 0 }, { hash: 0 }],
      transactionType: 2,
      tokenType: withdrawParams.tokenType,
      tokenId,
      value,
      ercAddress,
      recipientAddress,
      nullifiers,
      proof,
    });
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticWithdrawTransaction))
      .encodeABI();
    if (change !== 0n) await storeCommitment(newCommitment[0], nullifierKey);
    // on successful computation of the transaction mark the old commitments as nullified
    await Promise.all(
      oldCommitments.map(commitment => markNullified(commitment, optimisticWithdrawTransaction)),
    );
    // await saveTransaction(optimisticWithdrawTransaction);
    return { rawTransaction, transaction: optimisticWithdrawTransaction };
  } catch (err) {
    await Promise.all(oldCommitments.map(commitment => clearPending(commitment)));
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
