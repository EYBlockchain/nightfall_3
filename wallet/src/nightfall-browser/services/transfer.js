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

import rand from '../../common-files/utils/crypto/crypto-random';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Secrets, Nullifier, Commitment, PublicInputs, Transaction } from '../classes/index';
import {
  findUsableCommitmentsMutex,
  storeCommitment,
  markNullified,
  clearPending,
  getSiblingInfo,
} from './commitment-storage';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';
import { decompressKey, calculateIvkPkdfromAskNsk } from './keys';

// eslint-disable-next-line
import * as singleTransferAbi from '../../zokrates/single_transfer_stub/artifacts/single_transfer_stub-abi.json';
// eslint-disable-next-line
import * as singleTransferProgramFile from '../../zokrates/single_transfer_stub/artifacts/single_transfer_stub-program';
// eslint-disable-next-line
import * as singleTransferPkFile from '../../zokrates/single_transfer_stub/keypair/single_transfer_stub-pk';
// eslint-disable-next-line
import * as doubleTransferAbi from '../../zokrates/double_transfer_stub/artifacts/double_transfer_stub-abi.json';
// eslint-disable-next-line
import * as doubleTransferProgramFile from '../../zokrates/double_transfer_stub/artifacts/double_transfer_stub-program';
// eslint-disable-next-line
import * as doubleTransferPkFile from '../../zokrates/double_transfer_stub/keypair/double_transfer_stub-pk';

const { BN128_GROUP_ORDER, ZKP_KEY_LENGTH, SHIELD_CONTRACT_NAME } = config;
const { generalise, GN } = gen;

async function transfer(transferParams) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { ...items } = transferParams;
  const { ercAddress, tokenId, recipientData, nsk, ask, fee } = generalise(items);
  const { pkd, compressedPkd } = calculateIvkPkdfromAskNsk(ask, nsk);
  const { recipientCompressedPkds, values } = recipientData;
  const recipientPkds = recipientCompressedPkds.map(key => decompressKey(key));
  if (recipientCompressedPkds.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  // the first thing we need to do is to find some input commitments which
  // will enable us to conduct our transfer.  Let's rummage in the db...
  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  const oldCommitments = await findUsableCommitmentsMutex(
    compressedPkd,
    ercAddress,
    tokenId,
    totalValueToSend,
  );
  if (oldCommitments) logger.debug(`Found commitments ${JSON.stringify(oldCommitments, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  // Having found either 1 or 2 commitments, which are suitable inputs to the
  // proof, the next step is to compute their nullifiers;
  const nullifiers = oldCommitments.map(commitment => new Nullifier(commitment, nsk));
  // then the new output commitment(s)
  const totalInputCommitmentValue = oldCommitments.reduce(
    (acc, commitment) => acc + commitment.preimage.value.bigInt,
    0n,
  );
  // we may need to return change to the recipient
  const change = totalInputCommitmentValue - totalValueToSend;
  // if so, add an output commitment to do that
  if (change !== 0n) {
    values.push(new GN(change));
    recipientPkds.push(pkd);
    recipientCompressedPkds.push(compressedPkd);
  }
  const newCommitments = [];
  let secrets = [];
  const salts = [];
  let potentialSalt;
  let potentialCommitment;
  for (let i = 0; i < recipientCompressedPkds.length; i++) {
    // loop to find a new salt until the commitment hash is smaller than the BN128_GROUP_ORDER
    do {
      // eslint-disable-next-line no-await-in-loop
      potentialSalt = new GN((await rand(ZKP_KEY_LENGTH)).bigInt % BN128_GROUP_ORDER);
      potentialCommitment = new Commitment({
        ercAddress,
        tokenId,
        value: values[i],
        pkd: recipientPkds[i],
        compressedPkd: recipientCompressedPkds[i],
        salt: potentialSalt,
      });
      // encrypt secrets such as erc20Address, tokenId, value, salt for recipient
      if (i === 0) {
        // eslint-disable-next-line no-await-in-loop
        secrets = await Secrets.encryptSecrets(
          [ercAddress.bigInt, tokenId.bigInt, values[i].bigInt, potentialSalt.bigInt],
          [recipientPkds[0][0].bigInt, recipientPkds[0][1].bigInt],
        );
      }
    } while (potentialCommitment.hash.bigInt > BN128_GROUP_ORDER);
    salts.push(potentialSalt);
    newCommitments.push(potentialCommitment);
  }

  // compress the secrets to save gas
  const compressedSecrets = Secrets.compressSecrets(secrets);

  const commitmentTreeInfo = await Promise.all(oldCommitments.map(c => getSiblingInfo(c)));
  const localSiblingPaths = commitmentTreeInfo.map(l => {
    const path = l.siblingPath.path.map(p => p.value);
    return generalise([l.root].concat(path.reverse()));
  });
  const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
  const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
  const roots = commitmentTreeInfo.map(l => l.root);

  // public inputs
  const publicInputs = new PublicInputs([
    oldCommitments.map(commitment => commitment.preimage.ercAddress),
    newCommitments.map(commitment => commitment.hash),
    nullifiers.map(nullifier => nullifier.hash),
    roots,
    compressedSecrets.map(compressedSecret => compressedSecret.hex()),
  ]);
  // time for a quick sanity check.  We expect the number of old commitments,
  // new commitments and nullifiers to be equal.
  if (nullifiers.length !== oldCommitments.length || nullifiers.length !== newCommitments.length) {
    logger.error(
      `number of old commitments: ${oldCommitments.length}, number of new commitments: ${newCommitments.length}, number of nullifiers: ${nullifiers.length}`,
    );
    throw new Error(
      'Commitment or nullifier numbers are mismatched.  There should be equal numbers of each',
    );
  }

  // now we have everything we need to create a Witness and compute a proof
  const witnessInput = [
    publicInputs.hash.decimal, // TODO safer to make this a prime field??
    oldCommitments.map(commitment => [
      commitment.preimage.ercAddress.limbs(32, 8),
      commitment.preimage.tokenId.limbs(32, 8),
      commitment.preimage.value.limbs(32, 8),
      commitment.preimage.salt.limbs(32, 8),
      commitment.hash.limbs(32, 8),
      ask.field(BN128_GROUP_ORDER),
    ]),
    newCommitments.map(commitment => [
      [
        commitment.preimage.pkd[0].field(BN128_GROUP_ORDER),
        commitment.preimage.pkd[1].field(BN128_GROUP_ORDER),
      ],
      commitment.preimage.value.limbs(32, 8),
      commitment.preimage.salt.limbs(32, 8),
      commitment.hash.limbs(32, 8),
    ]),
    nullifiers.map(nullifier => [nullifier.preimage.nsk.limbs(32, 8), nullifier.hash.limbs(32, 8)]),
    localSiblingPaths.map(siblingPath =>
      siblingPath.map(node => node.field(BN128_GROUP_ORDER, false)),
    ), // siblingPAth[32] is a sha hash and will overflow a field but it's ok to take the mod here - hence the 'false' flag
    leafIndices,
    [
      ...secrets.ephemeralKeys.map(key => key.limbs(32, 8)),
      secrets.cipherText.flat().map(text => text.field(BN128_GROUP_ORDER)),
      ...secrets.squareRootsElligator2.map(sqroot => sqroot.field(BN128_GROUP_ORDER)),
    ],
  ].flat(Infinity);

  console.log(`witness input is ${JSON.stringify(witnessInput)}`);
  // call a zokrates worker to generate the proof
  // This is (so far) the only place where we need to get specific about the
  // circuit
  let transactionType;
  let program;
  let pk;
  let abi;
  const zokratesProvider = await initialize();
  if (oldCommitments.length === 1) {
    transactionType = 1;
    console.log('Getting single transfer program file');
    program = await fetch(singleTransferProgramFile)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    console.log('Getting single transfer pk file');
    pk = await fetch(singleTransferPkFile)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    console.log('Getting single transfer abi file');
    abi = singleTransferAbi;
    blockNumberL2s.push(0); // We need top pad block numbers if we do a single transfer
  } else if (oldCommitments.length === 2) {
    transactionType = 2;
    program = await fetch(doubleTransferProgramFile)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    pk = await fetch(doubleTransferPkFile)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    abi = doubleTransferAbi;
  } else throw new Error('Unsupported number of commitments');

  console.log('Artifacts');
  const artifacts = { program: new Uint8Array(program), abi: JSON.stringify(abi) };
  console.log('keypair');
  const keypair = { pk: new Uint8Array(pk) };
  console.log('Witness');
  const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
  // generate proof
  console.log('Proof');
  let { proof } = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
  proof = [...proof.a, ...proof.b, ...proof.c];
  proof = proof.flat(Infinity);
  console.log('Output');
  // logger.silly(`Received response ${JSON.stringify(res.data, null, 2)}`);
  // const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const optimisticTransferTransaction = new Transaction({
    fee,
    historicRootBlockNumberL2: blockNumberL2s,
    transactionType,
    publicInputs,
    ercAddress,
    commitments: newCommitments,
    nullifiers,
    compressedSecrets,
    proof,
  });
  try {
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticTransferTransaction))
      .encodeABI();
    // store the commitment on successful computation of the transaction
    newCommitments
      .filter(commitment => commitment.preimage.compressedPkd.hex(32) === compressedPkd.hex(32))
      .forEach(commitment => storeCommitment(commitment, nsk)); // TODO insertMany
    // mark the old commitments as nullified
    await Promise.all(
      oldCommitments.map(commitment => markNullified(commitment, optimisticTransferTransaction)),
    );
    return {
      rawTransaction,
      transaction: optimisticTransferTransaction,
      salts: salts.map(salt => salt.hex(32)),
    };
  } catch (err) {
    await Promise.all(oldCommitments.map(commitment => clearPending(commitment)));
    throw new Error(err); // let the caller handle the error
  }
}

export default transfer;
