/* ignore unused exports */

/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import gen from 'general-number';
import { wrap } from 'comlink';

import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Nullifier, Transaction } from '../classes/index';
import {
  findUsableCommitmentsMutex,
  markNullified,
  clearPending,
  getSiblingInfo,
} from './commitment-storage';
import { calculateIvkPkdfromAskNsk } from './keys';
import { checkIndexDBForCircuit, getStoreCircuit } from './database';
import generateProofWorker from '../../web-worker/generateProof.shared-worker';

const generateProof = wrap(generateProofWorker().port);

const { BN128_GROUP_ORDER, SHIELD_CONTRACT_NAME, USE_STUBS } = global.config;
const { generalise } = gen;
const circuitName = USE_STUBS ? 'withdraw_stub' : 'withdraw';

async function withdraw(withdrawParams, shieldContractAddress) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const { ercAddress, tokenId, value, recipientAddress, nsk, ask, fee } =
    generalise(withdrawParams);
  const { compressedPkd } = calculateIvkPkdfromAskNsk(ask, nsk);

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
  const [oldCommitment] = (await findUsableCommitmentsMutex(
    compressedPkd,
    ercAddress,
    tokenId,
    value,
    true,
  )) || [null];
  if (oldCommitment) logger.debug(`Found commitment ${JSON.stringify(oldCommitment, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  try {
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

    // public inputs
    const { leafIndex, isOnChain } = commitmentTreeInfo;

    // now we have everything we need to create a Witness and compute a proof
    const witnessInput = [
      oldCommitment.preimage.ercAddress.integer,
      oldCommitment.preimage.tokenId.integer,
      oldCommitment.preimage.value.integer,
      {
        salt: oldCommitment.preimage.salt.limbs(32, 8),
        hash: oldCommitment.hash.limbs(32, 8),
        ask: ask.field(BN128_GROUP_ORDER),
      },
      nullifier.preimage.nsk.limbs(32, 8),
      generalise(nullifier.hash.hex(32, 31)).integer,
      recipientAddress.field(BN128_GROUP_ORDER),
      siblingPath[0].field(BN128_GROUP_ORDER),
      siblingPath.slice(1).map(node => node.field(BN128_GROUP_ORDER, false)), // siblingPAth[32] is a sha hash and will overflow a field but it's ok to take the mod here - hence the 'false' flag
      leafIndex.toString(),
    ];

    logger.debug(`witness input is ${JSON.stringify(witnessInput)}`);

    const artifacts = { program: new Uint8Array(program), abi };
    const provingKey = new Uint8Array(pk);

    let { proof } = await generateProof(artifacts, witnessInput, provingKey);
    proof = [...proof.a, ...proof.b, ...proof.c];
    proof = proof.flat(Infinity);
    // and work out the ABI encoded data that the caller should sign and send to the shield contract
    const shieldContractInstance = await getContractInstance(
      SHIELD_CONTRACT_NAME,
      shieldContractAddress,
    );
    const optimisticWithdrawTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: [isOnChain, 0],
      transactionType: 3,
      tokenType: withdrawParams.tokenType,
      tokenId,
      value,
      ercAddress,
      recipientAddress,
      nullifiers: [nullifier],
      proof,
    });
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticWithdrawTransaction))
      .encodeABI();
    // on successful computation of the transaction mark the old commitments as nullified
    await markNullified(oldCommitment, optimisticWithdrawTransaction);
    // await saveTransaction(optimisticWithdrawTransaction);
    return { rawTransaction, transaction: optimisticWithdrawTransaction };
  } catch (err) {
    await clearPending(oldCommitment);
    throw new Error(err); // let the caller handle the error
  }
}

export default withdraw;
