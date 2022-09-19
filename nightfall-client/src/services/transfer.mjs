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
import { edwardsCompress } from 'common-files/utils/curve-maths/curves.mjs';
import constants from 'common-files/constants/index.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import mongo from 'common-files/utils/mongo.mjs';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import { Commitment, Nullifier, Transaction } from '../classes/index.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { encrypt, genEphemeralKeys, packSecrets } from './kem-dem.mjs';
import {
  clearPending,
  getSiblingInfo,
  markNullified,
  storeCommitment,
} from './commitment-storage.mjs';
import getProposersUrl from './peers.mjs';

const {
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  PROTOCOL,
  USE_STUBS,
  VK_IDS,
  TRANSACTION,
  COMMITMENTS_COLLECTION,
  COMMITMENTS_DB,
  MONGO_URL,
  BN128_GROUP_ORDER,
} = config;
const { SHIELD_CONTRACT_NAME } = constants;
const { generalise } = gen;

const NEXT_N_PROPOSERS = 3;

const getCommitmentByHash = async hash => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitment = await db.collection(COMMITMENTS_COLLECTION).findOne({ _id: hash.hex(32) });
  return commitment;
};

async function transfer(transferParams) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { offchain = false, ...items } = transferParams;
  const { commitmentsToUse, recipientData, rootKey, fee } = generalise(items);
  const { recipientCompressedZkpPublicKeys, values } = recipientData;
  const recipientZkpPublicKeys = recipientCompressedZkpPublicKeys.map(key =>
    ZkpKeys.decompressZkpPublicKey(key),
  );
  if (recipientCompressedZkpPublicKeys.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );
  const { nullifierKey, zkpPublicKey } = new ZkpKeys(rootKey);

  logger.debug(`The erc address of the fee is the following: ${maticAddress.hex(32)}`);
  const useCommitmentsDB = await Promise.all(commitmentsToUse.map(c => getCommitmentByHash(c))); // CHeck ordering
  const useCommitments = useCommitmentsDB.map(c => new Commitment(c.preimage));
  // const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  const commitmentTreeInfo = await Promise.all(useCommitments.map(c => getSiblingInfo(c)));
  const localSiblingPaths = commitmentTreeInfo.map(l => {
    const path = l.siblingPath.path.map(p => p.value);
    return generalise([l.root].concat(path.reverse()));
  });
  const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
  const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
  const roots = commitmentTreeInfo.map(l => l.root);
  const salt = await randValueLT(BN128_GROUP_ORDER);
  const outputCommitments = useCommitments.map(
    c =>
      new Commitment({
        ercAddress: c.preimage.ercAddress,
        tokenId: c.preimage.tokenId,
        value: c.preimage.value,
        zkpPublicKey: recipientZkpPublicKeys[0],
        salt,
      }),
  );
  const commitmentsInfo = {
    oldCommitments: useCommitments,
    nullifiers: useCommitments.map(commitment => new Nullifier(commitment, nullifierKey)),
    newCommitments: outputCommitments,
    localSiblingPaths,
    leafIndices,
    blockNumberL2s,
    roots,
    salts: [salt],
  };

  try {
    // KEM-DEM encryption
    logger.debug('KEM_DEMING');

    const [ePrivate, ePublic] = await genEphemeralKeys();
    const [unpackedTokenID, packedErc] = packSecrets(
      useCommitments[0].preimage.tokenId,
      useCommitments[0].preimage.ercAddress,
      0,
      2,
    );
    const compressedSecrets = encrypt(generalise(ePrivate), generalise(recipientZkpPublicKeys[0]), [
      packedErc.bigInt,
      unpackedTokenID.bigInt,
      generalise(useCommitments[0].preimage.value).bigInt,
      commitmentsInfo.salts[0].bigInt,
    ]);

    // Compress the public key as it will be put on-chain
    const compressedEPub = edwardsCompress(ePublic);
    logger.debug('COMPRESSED EPUB');
    // now we have everything we need to create a Witness and compute a proof
    const transaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 1,
      ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
      tokenId: compressedSecrets[1], // this is the encrypted tokenID
      recipientAddress: compressedEPub,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
      numberNullifiers: VK_IDS.transfer.numberNullifiers,
      numberCommitments: VK_IDS.transfer.numberCommitments,
      calculateHash: false,
    });

    const privateData = {
      rootKey: [rootKey, rootKey, rootKey, rootKey],
      oldCommitmentPreimage: commitmentsInfo.oldCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      paths: commitmentsInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
      orders: commitmentsInfo.leafIndices,
      newCommitmentPreimage: commitmentsInfo.newCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      recipientPublicKeys: commitmentsInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
      ercAddress: useCommitments[0].preimage.ercAddress,
      tokenId: useCommitments[0].preimage.tokenId,
      ephemeralKey: ePrivate,
    };

    const witness = computeCircuitInputs(
      transaction,
      privateData,
      commitmentsInfo.roots,
      maticAddress,
      VK_IDS.transfer.numberNullifiers,
      VK_IDS.transfer.numberCommitments,
    );
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
    logger.trace(`Received response ${JSON.stringify(res.data, null, 2)}`);
    const { proof } = res.data;
    // and work out the ABI encoded data that the caller should sign and send to the shield contract

    const optimisticTransferTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 1,
      ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
      tokenId: compressedSecrets[1], // this is the encrypted tokenID
      recipientAddress: compressedEPub,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
      proof,
      numberNullifiers: TRANSACTION.numberNullifiers,
      numberCommitments: TRANSACTION.numberCommitments,
    });

    logger.debug(
      `Client made transaction ${JSON.stringify(
        optimisticTransferTransaction,
        null,
        2,
      )} offchain ${offchain}`,
    );

    const { compressedZkpPublicKey } = new ZkpKeys(rootKey);

    // Store new commitments that are ours.
    const storeNewCommitments = commitmentsInfo.newCommitments
      .filter(c => c.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32))
      .map(c => storeCommitment(c, nullifierKey));

    const nullifyOldCommitments = commitmentsInfo.oldCommitments.map(c =>
      markNullified(c, optimisticTransferTransaction),
    );

    await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);

    const returnObj = { transaction: optimisticTransferTransaction };

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
            `http://optimist:80/proposer/offchain-transaction`,
            { transaction: optimisticTransferTransaction },
            { timeout: 3600000 },
          );
        }),
      );
    } else {
      returnObj.rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(optimisticTransferTransaction))
        .encodeABI();
    }
    return returnObj;
  } catch (error) {
    await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
    throw new Error(error);
  }
}

export default transfer;
