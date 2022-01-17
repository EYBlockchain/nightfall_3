/* ignore unused exports */
/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import config from 'config';
import gen from 'general-number';
import { initialize } from 'zokrates-js';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Nullifier, PublicInputs, Transaction } from '../classes/index';
import {
  findUsableCommitmentsMutex,
  markNullified,
  clearPending,
  getSiblingInfo,
} from './commitment-storage';
import { calculateIvkPkdfromAskNsk } from './keys';

// eslint-disable-next-line
import abi from '../../zokrates/withdraw_stub/artifacts/withdraw_stub-abi.json';
// eslint-disable-next-line
import programFile from '../../zokrates/withdraw_stub/artifacts/withdraw_stub-program';
// eslint-disable-next-line
import pkFile from '../../zokrates/withdraw_stub/keypair/withdraw_stub-pk';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

const { BN128_GROUP_ORDER, SHIELD_CONTRACT_NAME } = config;
const { generalise } = gen;

async function withdraw(withdrawParams) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const { ...items } = withdrawParams;
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

  // public inputs
  const { root, leafIndex, isOnChain } = commitmentTreeInfo;
  const publicInputs = new PublicInputs([
    oldCommitment.preimage.ercAddress,
    oldCommitment.preimage.tokenId,
    oldCommitment.preimage.value,
    nullifier.hash,
    recipientAddress,
    root,
  ]);

  // now we have everything we need to create a Witness and compute a proof
  const witnessInput = [
    publicInputs.hash.decimal, // TODO safer to make this a prime field??
    oldCommitment.preimage.ercAddress.limbs(32, 8),
    oldCommitment.preimage.tokenId.limbs(32, 8),
    oldCommitment.preimage.value.limbs(32, 8),
    oldCommitment.preimage.salt.limbs(32, 8),
    oldCommitment.hash.limbs(32, 8),
    ask.field(BN128_GROUP_ORDER),
    nullifier.preimage.nsk.limbs(32, 8),
    nullifier.hash.limbs(32, 8),
    recipientAddress.field(BN128_GROUP_ORDER),
    siblingPath.map(node => node.field(BN128_GROUP_ORDER, false)), // siblingPAth[32] is a sha hash and will overflow a field but it's ok to take the mod here - hence the 'false' flag
    leafIndex,
  ].flat(Infinity);

  logger.debug(`witness input is ${witnessInput.join(' ')}`);
  // call a zokrates worker to generate the proof
  const zokratesProvider = await initialize();
  const program = await fetch(programFile)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);
  const pk = await fetch(pkFile)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);

  const artifacts = { program: new Uint8Array(program), abi: JSON.stringify(abi) };
  const keypair = { pk: new Uint8Array(pk) };
  // computation
  const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
  // generate proof
  let { proof } = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
  proof = [...proof.a, ...proof.b, ...proof.c];
  proof = proof.flat(Infinity);
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const optimisticWithdrawTransaction = new Transaction({
    fee,
    historicRootBlockNumberL2: [isOnChain, 0],
    transactionType: 3,
    tokenType: items.tokenType,
    publicInputs,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    nullifiers: [nullifier],
    proof,
  });
  try {
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
