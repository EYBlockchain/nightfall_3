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
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import { edwardsCompress } from 'common-files/utils/curve-maths/curves.mjs';
import { Nullifier, Commitment, Transaction } from '../classes/index.mjs';
import {
  findUsableCommitmentsMutex,
  storeCommitment,
  markNullified,
  clearPending,
  getSiblingInfo,
} from './commitment-storage.mjs';
import getProposersUrl from './peers.mjs';
import { ZkpKeys } from './keys.mjs';
import { encrypt, genEphemeralKeys, packSecrets } from './kem-dem.mjs';
import { computeWitness } from '../utils/compute-witness.mjs';

const {
  BN128_GROUP_ORDER,
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  SHIELD_CONTRACT_NAME,
  PROTOCOL,
  USE_STUBS,
} = config;
const { generalise, GN } = gen;

const NEXT_N_PROPOSERS = 3;

async function transfer(transferParams) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { offchain = false, ...items } = transferParams;
  const { ercAddress, tokenId, recipientData, rootKey, fee } = generalise(items);
  const { zkpPublicKey, compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);
  const { recipientCompressedZkpPublicKeys, values } = recipientData;
  const recipientZkpPublicKeys = recipientCompressedZkpPublicKeys.map(key =>
    ZkpKeys.decompressZkpPublicKey(key),
  );
  if (recipientCompressedZkpPublicKeys.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  // the first thing we need to do is to find some input commitments which
  // will enable us to conduct our transfer.  Let's rummage in the db...
  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  const oldCommitments = await findUsableCommitmentsMutex(
    compressedZkpPublicKey,
    ercAddress,
    tokenId,
    totalValueToSend,
  );
  if (oldCommitments) logger.debug(`Found commitments ${JSON.stringify(oldCommitments, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  // Having found either 1 or 2 commitments, which are suitable inputs to the
  // proof, the next step is to compute their nullifiers;
  const nullifiers = oldCommitments.map(commitment => new Nullifier(commitment, nullifierKey));
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
    recipientZkpPublicKeys.push(zkpPublicKey);
    recipientCompressedZkpPublicKeys.push(compressedZkpPublicKey);
  }
  // Generate salts, constrained to be < field size
  const salts = await Promise.all(values.map(async () => randValueLT(BN128_GROUP_ORDER)));

  // Generate new commitments, already truncated to u32[7]
  const newCommitments = values.map(
    (value, i) =>
      new Commitment({
        ercAddress,
        tokenId,
        value,
        zkpPublicKey: recipientZkpPublicKeys[i],
        salt: salts[i].bigInt,
      }),
  );

  // KEM-DEM encryption
  const [ePrivate, ePublic] = await genEphemeralKeys();
  const [unpackedTokenID, packedErc] = packSecrets(tokenId, ercAddress, 0, 2);
  const compressedSecrets = encrypt(generalise(ePrivate), generalise(recipientZkpPublicKeys[0]), [
    packedErc.bigInt,
    unpackedTokenID.bigInt,
    values[0].bigInt,
    salts[0].bigInt,
  ]);

  // Compress the public key as it will be put on-chain
  const compressedEPub = edwardsCompress(ePublic);

  // Commitment Tree Information
  const commitmentTreeInfo = await Promise.all(oldCommitments.map(c => getSiblingInfo(c)));
  const localSiblingPaths = commitmentTreeInfo.map(l => {
    const path = l.siblingPath.path.map(p => p.value);
    return generalise([l.root].concat(path.reverse()));
  });
  const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
  const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
  const roots = commitmentTreeInfo.map(l => l.root);
  logger.info(
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
  const transaction = Transaction.buildSolidityStruct(
    new Transaction({
      fee,
      historicRootBlockNumberL2: blockNumberL2s,
      transactionType: 1,
      ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
      tokenId: compressedSecrets[1], // this is the encrypted tokenID
      recipientAddress: compressedEPub,
      commitments: newCommitments,
      nullifiers,
      compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
    }),
  );

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
    ercAddress,
    tokenId,
    ephemeralKey: ePrivate,
  };

  const witness = computeWitness(transaction, roots, privateData);
  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  let folderpath = 'transfer';
  if (USE_STUBS) folderpath = 'transfer_stub';
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
  const optimisticTransferTransaction = new Transaction({
    fee,
    historicRootBlockNumberL2: blockNumberL2s,
    transactionType: 1,
    ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
    tokenId: compressedSecrets[1], // this is the encrypted tokenID
    recipientAddress: compressedEPub,
    commitments: newCommitments,
    nullifiers,
    compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
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
        .filter(
          commitment =>
            commitment.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32),
        )
        .forEach(commitment => storeCommitment(commitment, nullifierKey)); // TODO insertMany
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
      .filter(
        commitment => commitment.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32),
      )
      .forEach(commitment => storeCommitment(commitment, nullifierKey)); // TODO insertMany
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
