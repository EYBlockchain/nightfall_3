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
import { Nullifier, Transaction } from '../classes/index.mjs';
import {
  findUsableCommitmentsMutex,
  markNullified,
  clearPending,
  getSiblingInfo,
} from './commitment-storage.mjs';
import getProposersUrl from './peers.mjs';
import { calculateIvkPkdfromAskNsk } from './keys.mjs';

const {
  BN128_GROUP_ORDER,
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  SHIELD_CONTRACT_NAME,
  PROTOCOL,
  USE_STUBS,
} = config;
const { generalise } = gen;

const NEXT_N_PROPOSERS = 3;

async function withdraw(withdrawParams) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const { offchain = false, ...items } = withdrawParams;
  const { ercAddress, tokenId, value, recipientAddress, nsk, ask, fee } = generalise(items);
  const { compressedPkd } = await calculateIvkPkdfromAskNsk(ask, nsk);

  // the first thing we need to do is to find and input commitment which
  // will enable us to conduct our withdraw.  Let's rummage in the db...
  const [oldCommitment] = (await findUsableCommitmentsMutex(
    compressedPkd,
    ercAddress,
    tokenId,
    value,
    true,
  )) || [null];
  if (oldCommitment) logger.debug(`Found commitment ${JSON.stringify(oldCommitment, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  // Having found 1 commitment, which is a suitable input to the
  // proof, the next step is to compute its nullifier;
  const nullifier = new Nullifier(oldCommitment, nsk);
  // and the Merkle path from the commitment to the root
  const commitmentTreeInfo = await getSiblingInfo(oldCommitment);
  const siblingPath = generalise(
    [commitmentTreeInfo.root].concat(
      commitmentTreeInfo.siblingPath.path.map(p => p.value).reverse(),
    ),
  );
  logger.silly(`SiblingPath was: ${JSON.stringify(siblingPath)}`);

  const { leafIndex, isOnChain } = commitmentTreeInfo;

  // now we have everything we need to create a Witness and compute a proof
  const witness = [
    oldCommitment.preimage.ercAddress.field(BN128_GROUP_ORDER),
    oldCommitment.preimage.tokenId.limbs(32, 8),
    oldCommitment.preimage.value.field(BN128_GROUP_ORDER),
    oldCommitment.preimage.salt.field(BN128_GROUP_ORDER),
    oldCommitment.hash.field(BN128_GROUP_ORDER),
    ask.field(BN128_GROUP_ORDER),
    nullifier.preimage.nsk.field(BN128_GROUP_ORDER),
    nullifier.hash.field(BN128_GROUP_ORDER),
    recipientAddress.field(BN128_GROUP_ORDER),
    siblingPath[0].field(BN128_GROUP_ORDER),
    siblingPath.slice(1).map(node => node.field(BN128_GROUP_ORDER)), // siblingPAth[32] is a sha hash and will overflow a field but it's ok to take the mod here - hence the 'false' flag
    leafIndex,
  ].flat(Infinity);

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
    historicRootBlockNumberL2: [isOnChain, 0],
    transactionType: 3,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    nullifiers: [nullifier],
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
      // on successful computation of the transaction mark the old commitments as nullified
      await markNullified(oldCommitment, optimisticWithdrawTransaction);
      const th = optimisticWithdrawTransaction.transactionHash;
      delete optimisticWithdrawTransaction.transactionHash;
      optimisticWithdrawTransaction.transactionHash = th;
      return { transaction: optimisticWithdrawTransaction };
    }
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticWithdrawTransaction))
      .encodeABI();
    // on successful computation of the transaction mark the old commitments as nullified
    await markNullified(oldCommitment, optimisticWithdrawTransaction);
    return { rawTransaction, transaction: optimisticWithdrawTransaction };
  } catch (err) {
    await clearPending(oldCommitment);
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
