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
import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';
import { Transaction } from '../classes/index.mjs';
import { computeWitness } from '../utils/compute-witness.mjs';
import { getCommitmentsValues } from '../utils/getCommitmentValues.mjs';
import { updateCommitments } from '../utils/updateCommitments.mjs';

const {
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  PROTOCOL,
  USE_STUBS,
  RESTRICTIONS,
  ETH_NETWORK,
} = config;
const { SHIELD_CONTRACT_NAME } = constants;
const { generalise, GN } = gen;

const MAX_WITHDRAW = 5192296858534827628530496329220096n; // 2n**112n

async function withdraw(withdrawParams) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const { offchain = false, ...items } = withdrawParams;
  const { ercAddress, tokenId, value, recipientAddress, rootKey, fee } = generalise(items);

  const maticAddress = RESTRICTIONS.tokens[ETH_NETWORK].find(token => token.name === 'MATIC');

  const withdrawValue = value.bigInt > MAX_WITHDRAW ? MAX_WITHDRAW : value.bigInt;
  const {
    oldCommitments,
    nullifiers,
    newCommitments,
    localSiblingPaths,
    leafIndices,
    blockNumberL2s,
    roots,
  } = await getCommitmentsValues([withdrawValue], [], [], ercAddress, tokenId, rootKey);

  const {
    oldCommitmentsFee,
    nullifiersFee,
    newCommitmentsFee,
    localSiblingPathsFee,
    leafIndicesFee,
    blockNumberL2sFee,
    rootsFee,
  } = await getCommitmentsValues([fee.bigInt], [], [], maticAddress, 0, rootKey);

  // now we have everything we need to create a Witness and compute a proof
  const transaction = new Transaction({
    fee,
    historicRootBlockNumberL2: blockNumberL2s,
    historicRootBlockNumberL2Fee: blockNumberL2sFee,
    commitments: newCommitments,
    commitmentFee: newCommitmentsFee,
    transactionType: 2,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    nullifiers,
    nullifiersFee,
  });

  const privateData = {
    rootKey: [rootKey, rootKey],
    oldCommitmentPreimage: oldCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    paths: localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
    orders: leafIndices,
    newCommitmentPreimage: newCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    recipientPublicKeys: newCommitments.map(o => o.preimage.zkpPublicKey),
    rootKeyFee: [rootKey, rootKey],
    oldCommitmentPreimageFee: oldCommitmentsFee.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    pathsFee: localSiblingPathsFee.map(siblingPath => siblingPath.slice(1)),
    ordersFee: leafIndicesFee,
    newCommitmentPreimageFee: newCommitmentsFee.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    recipientPublicKeysFee: newCommitmentsFee.map(o => o.preimage.zkpPublicKey),
    ercAddress,
    tokenId,
  };

  const witness = computeWitness(transaction, privateData, roots, rootsFee, maticAddress);
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
  logger.trace(`Received response ${JSON.stringify(res.data, null, 2)}`);
  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const optimisticWithdrawTransaction = new Transaction({
    fee,
    historicRootBlockNumberL2: blockNumberL2s,
    historicRootBlockNumberL2Fee: blockNumberL2sFee,
    commitments: newCommitments,
    commitmentsFee: newCommitmentsFee,
    transactionType: 2,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    nullifiers,
    nullifiersFee,
    proof,
  });
  await updateCommitments(
    offchain,
    optimisticWithdrawTransaction,
    [...newCommitments, ...newCommitmentsFee],
    [...oldCommitments, ...oldCommitmentsFee],
    rootKey,
  );
}

export default withdraw;
