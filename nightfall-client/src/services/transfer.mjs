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
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import { Secrets, Nullifier, Commitment, Transaction } from '../classes/index.mjs';
import {
  findUsableCommitmentsMutex,
  storeCommitment,
  markNullified,
  clearPending,
  getSiblingInfo,
} from './commitment-storage.mjs';
import getProposersUrl from './peers.mjs';
import { decompressKey, calculateIvkPkdfromAskNsk } from './keys.mjs';

const {
  BN128_GROUP_ORDER,
  ZKP_KEY_LENGTH,
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  SHIELD_CONTRACT_NAME,
  PROTOCOL,
  USE_STUBS,
  ZERO,
} = config;
const { generalise, GN } = gen;

const NEXT_N_PROPOSERS = 3;

async function transfer(transferParams) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { offchain = false, ...items } = transferParams;
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
  }
  const newCommitments = [];
  let secrets = [];
  const salts = [];
  for (let i = 0; i < recipientPkds.length; i++) {
    newCommitments.push(
      new Commitment({
        ercAddress,
        tokenId,
        value: values[i],
        pkd: recipientPkds[i],
        salt: new GN((await rand(ZKP_KEY_LENGTH)).field(BN128_GROUP_ORDER, false)), // eslint-disable-line no-await-in-loop
      }),
    );
  }
  console.log('SECRETS1');
  console.log('ERC', ercAddress.bigInt);
  console.log('TOKEN', tokenId.bigInt);
  console.log('VALUE', values[0].bigInt);
  console.log('NEW_COM', newCommitments[0].preimage.salt.bigInt);
  console.log('SECRETS2', [recipientPkds[0][0].bigInt, recipientPkds[0][1].bigInt]);
  // encrypt secrets such as erc20Address, tokenId, value, salt for recipient
  secrets = await Secrets.encryptSecrets(
    [ercAddress.bigInt, tokenId.bigInt, values[0].bigInt, newCommitments[0].preimage.salt.bigInt],
    [recipientPkds[0][0].bigInt, recipientPkds[0][1].bigInt],
  );

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
  console.log(
    'Constructing transfer transaction with blockNumberL2s',
    blockNumberL2s,
    'and roots',
    roots,
  );

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
  const witness = [
    oldCommitments.map(commitment => commitment.preimage.ercAddress.field(BN128_GROUP_ORDER)),
    oldCommitments.map(commitment => [
      commitment.preimage.tokenId.limbs(32, 8),
      commitment.preimage.value.limbs(8, 31),
      commitment.preimage.salt.field(BN128_GROUP_ORDER),
      commitment.hash.field(BN128_GROUP_ORDER),
      ask.field(BN128_GROUP_ORDER),
    ]),
    newCommitments.map(commitment => [
      [
        commitment.preimage.pkd[0].field(BN128_GROUP_ORDER),
        commitment.preimage.pkd[1].field(BN128_GROUP_ORDER),
      ],
      commitment.preimage.value.limbs(8, 31),
      commitment.preimage.salt.field(BN128_GROUP_ORDER),
    ]),
    newCommitments.map(commitment => commitment.hash.field(BN128_GROUP_ORDER)),
    nullifiers.map(nullifier => nullifier.preimage.nsk.field(BN128_GROUP_ORDER)),
    nullifiers.map(nullifier => nullifier.hash.field(BN128_GROUP_ORDER)),
    localSiblingPaths.map(siblingPath => siblingPath[0].field(BN128_GROUP_ORDER)),
    localSiblingPaths.map(siblingPath =>
      siblingPath.slice(1).map(node => node.field(BN128_GROUP_ORDER)),
    ),
    leafIndices,
    [
      ...secrets.ephemeralKeys.map(key => key.limbs(32, 8)),
      secrets.cipherText.flat().map(text => text.field(BN128_GROUP_ORDER)),
      ...secrets.squareRootsElligator2.map(sqroot => sqroot.field(BN128_GROUP_ORDER)),
    ],
    compressedSecrets.map(text => {
      const bin = text.binary.padStart(256, '0');
      const parity = bin[0];
      const ordinate = bin.slice(1);
      const fields = [parity, new GN(ordinate, 'binary').field(BN128_GROUP_ORDER)];
      return fields;
    }),
  ].flat(Infinity);

  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  // This is (so far) the only place where we need to get specific about the
  // circuit
  let folderpath;
  let transactionType;
  if (oldCommitments.length === 1) {
    folderpath = 'single_transfer';
    transactionType = 1;
    blockNumberL2s.push(0); // We need top pad block numbers if we do a single transfer
  } else if (oldCommitments.length === 2) {
    folderpath = 'double_transfer';
    transactionType = 2;
  } else throw new Error('Unsupported number of commitments');
  if (USE_STUBS) folderpath = `${folderpath}_stub`;
  const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
    folderpath,
    inputs: await witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });
  logger.silly(`Received response ${JSON.stringify(res.data, null, 2)}`);
  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const optimisticTransferTransaction = new Transaction({
    fee,
    historicRootBlockNumberL2: blockNumberL2s,
    transactionType,
    ercAddress: ZERO, // we don't want to expose the ERC address during a transfer
    commitments: newCommitments,
    nullifiers,
    compressedSecrets,
    proof,
  });
  logger.debug(
    `Client made transaction ${JSON.stringify(
      optimisticTransferTransaction,
      null,
      2,
    )} offchain ${offchain}`,
  );
  try {
    if (offchain) {
      // dig up connection peers
      const peerList = await getProposersUrl(NEXT_N_PROPOSERS);
      logger.debug(`Peer List: ${JSON.stringify(peerList, null, 2)}`);
      await Promise.all(
        Object.keys(peerList).map(async address => {
          logger.debug(
            `offchain transaction - calling ${peerList[address]}/proposer/offchain-transaction`,
          );
          return axios.post(
            `${peerList[address]}/proposer/offchain-transaction`,
            { transaction: optimisticTransferTransaction },
            { timeout: 3600000 },
          );
        }),
      );
      // we only want to store our own commitments so filter those that don't
      // have our public key
      newCommitments
        .filter(commitment => commitment.preimage.compressedPkd.bigInt === compressedPkd.bigInt)
        .forEach(commitment => storeCommitment(commitment, nsk)); // TODO insertMany
      // mark the old commitments as nullified
      await Promise.all(
        oldCommitments.map(commitment => markNullified(commitment, optimisticTransferTransaction)),
      );
      return {
        transaction: optimisticTransferTransaction,
        salts: salts.map(salt => salt.hex(32)),
      };
    }
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticTransferTransaction))
      .encodeABI();
    // store the commitment on successful computation of the transaction
    newCommitments
      .filter(commitment => commitment.preimage.compressedPkd.bigInt === compressedPkd.bigInt)
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
