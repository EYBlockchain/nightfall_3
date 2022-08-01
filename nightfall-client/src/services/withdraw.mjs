/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import { Commitment, Nullifier, Transaction } from '../classes/index.mjs';
import {
  findUsableCommitmentsMutex,
  markNullified,
  clearPending,
  getSiblingInfo,
  storeCommitment,
} from './commitment-storage.mjs';
import getProposersUrl from './peers.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeWitness } from '../utils/compute-witness.mjs';

const { BN128_GROUP_ORDER, ZOKRATES_WORKER_HOST, PROVING_SCHEME, BACKEND, PROTOCOL, USE_STUBS } =
  config;
const { SHIELD_CONTRACT_NAME } = constants;
const { generalise, GN } = gen;

const NEXT_N_PROPOSERS = 3;
const MAX_WITHDRAW = 5192296858534827628530496329220096n; // 2n**112n

async function withdraw(withdrawParams) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const { offchain = false, ...items } = withdrawParams;
  const { ercAddress, tokenId, value, recipientAddress, rootKey, fee } = generalise(items);
  const { compressedZkpPublicKey, nullifierKey, zkpPublicKey } = new ZkpKeys(rootKey);

  // the first thing we need to do is to find and input commitment which
  // will enable us to conduct our withdraw.  Let's rummage in the db...
  const oldCommitments = await findUsableCommitmentsMutex(
    compressedZkpPublicKey,
    ercAddress,
    tokenId,
    value,
  );
  if (oldCommitments) logger.debug(`Found commitments ${JSON.stringify(oldCommitments, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
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
  // Commitment Tree Information
  const commitmentTreeInfo = await Promise.all(oldCommitments.map(c => getSiblingInfo(c)));
  const localSiblingPaths = commitmentTreeInfo.map(l => {
    const path = l.siblingPath.path.map(p => p.value);
    return generalise([l.root].concat(path.reverse()));
  });
  const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
  const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
  logger.silly(`SiblingPath was: ${JSON.stringify(localSiblingPaths)}`);

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
  const publicData = Transaction.buildSolidityStruct(
    new Transaction({
      fee,
      historicRootBlockNumberL2: blockNumberL2s,
      commitments: newCommitment.length > 0 ? newCommitment : [{ hash: 0 }, { hash: 0 }],
      transactionType: 2,
      tokenType: items.tokenType,
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

  const witness = computeWitness(
    publicData,
    localSiblingPaths.map(siblingPath => siblingPath[0]),
    privateData,
  );

  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  let folderpath = 'withdraw';
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
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const optimisticWithdrawTransaction = new Transaction({
    fee,
    historicRootBlockNumberL2: blockNumberL2s,
    commitments: newCommitment.length > 0 ? newCommitment : [{ hash: 0 }, { hash: 0 }],
    transactionType: 2,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    nullifiers,
    proof,
  });
  try {
    if (offchain) {
      const peerList = await getProposersUrl(NEXT_N_PROPOSERS);
      logger.debug(`Peer List: ${JSON.stringify(peerList, null, 2)}`);
      await Promise.all(
        Object.keys(peerList).map(async address => {
          logger.debug(
            `offchain transaction - calling ${peerList[address]}/proposer/offchain-transaction`,
          );
          return axios.post(
            `${peerList[address]}/proposer/offchain-transaction`,
            { transaction: optimisticWithdrawTransaction },
            { timeout: 3600000 },
          );
        }),
      );
      // we store the change commitment
      if (change !== 0n) {
        await storeCommitment(newCommitment[0], nullifierKey);
      }
      // on successful computation of the transaction mark the old commitments as nullified
      await Promise.all(
        oldCommitments.map(commitment => markNullified(commitment, optimisticWithdrawTransaction)),
      );
      const th = optimisticWithdrawTransaction.transactionHash;
      delete optimisticWithdrawTransaction.transactionHash;
      optimisticWithdrawTransaction.transactionHash = th;
      return { transaction: optimisticWithdrawTransaction };
    }
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticWithdrawTransaction))
      .encodeABI();
    // we store the change commitment
    if (change !== 0n) {
      await storeCommitment(newCommitment[0], nullifierKey);
    }
    // on successful computation of the transaction mark the old commitments as nullified
    await Promise.all(
      oldCommitments.map(commitment => markNullified(commitment, optimisticWithdrawTransaction)),
    );
    return { rawTransaction, transaction: optimisticWithdrawTransaction };
  } catch (err) {
    await Promise.all(oldCommitments.map(commitment => clearPending(commitment)));
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
