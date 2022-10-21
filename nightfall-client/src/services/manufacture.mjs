import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import logger from 'common-files/utils/logger.mjs';
// import { edwardsCompress } from 'common-files/utils/curve-maths/curves.mjs';
import constants from 'common-files/constants/index.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import mongo from 'common-files/utils/mongo.mjs';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import { Commitment, Nullifier, Transaction } from '../classes/index.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeManufactureCircuitInputs } from '../utils/computeCircuitInputs.mjs';
// import { encrypt, genEphemeralKeys, packSecrets } from './kem-dem.mjs';
import {
  clearPending,
  getSiblingInfo,
  markNullified,
  storeCommitment,
} from './commitment-storage.mjs';
import getProposersUrl from './peers.mjs';
// import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';

const {
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  PROTOCOL,
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

// const BillOfMaterials = [
//   {
//     partQty: [30],
//     partNumber: [1],
//     outputPartNumber: 99,
//   }
// ]

async function manufacture(manfParams) {
  logger.info('Creating a new Manufacture transaction');
  // let's extract the input items
  const { offchain = false, ...items } = manfParams;
  const {
    // ercAddress,
    // tokenId,
    recipientData,
    rootKey,
    fee,
    recipeIndex,
    commitmentsToUse,
    outputErcAddress,
    outputTokenId,
  } = generalise(items);
  const { recipientCompressedZkpPublicKeys } = recipientData;
  const { nullifierKey, zkpPublicKey } = new ZkpKeys(rootKey);

  // const recipientZkpPublicKeys = recipientCompressedZkpPublicKeys.map(key =>
  //   ZkpKeys.decompressZkpPublicKey(key),
  // );
  if (recipientCompressedZkpPublicKeys.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  // logger.debug(
  //   `The erc address of the token is the following: ${ercAddress.hex(32).toLowerCase()}`,
  // );

  logger.debug(`The erc address of the fee is the following: ${maticAddress.hex(32)}`);
  // const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  // const recipientZkpPublicKeysArray = Array.from({length: BillOfMaterials.partNumber.length}, (v, i) => i)
  // const salts = await Promise.all(
  //   recipientZkpPublicKeysArray.map(async () => randValueLT(BN128_GROUP_ORDER)),
  // );
  logger.debug(`This commimtnets to ${JSON.stringify(commitmentsToUse)}`);
  const useCommitmentsDB = []; // Do it this bad way because enforcing ordered retrieval from Mongo sucks
  for (let i = 0; i < commitmentsToUse.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const c = await getCommitmentByHash(commitmentsToUse[i]);
    useCommitmentsDB.push(c);
  }
  const useCommitments = useCommitmentsDB.map(c => new Commitment(c.preimage));
  // Commitment Tree Information
  logger.debug(`UseCommitmnets ${JSON.stringify(useCommitments)}`);
  const commitmentTreeInfo = [];
  for (let i = 0; i < useCommitments.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const c = await getSiblingInfo(useCommitments[i]);
    commitmentTreeInfo.push(c);
  }
  const localSiblingPaths = commitmentTreeInfo.map(l => {
    const path = l.siblingPath.path.map(p => p.value);
    return generalise([l.root].concat(path.reverse()));
  });
  const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
  const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
  const roots = commitmentTreeInfo.map(l => l.root);
  const salt = await randValueLT(BN128_GROUP_ORDER);
  const outputCommitment = new Commitment({
    ercAddress: outputErcAddress,
    tokenId: outputTokenId,
    value: '1',
    zkpPublicKey,
    salt,
  });

  const commitmentsInfo = {
    oldCommitments: useCommitments,
    nullifiers: useCommitments.map(commitment => new Nullifier(commitment, nullifierKey)),
    newCommitments: [outputCommitment],
    localSiblingPaths,
    leafIndices,
    blockNumberL2s,
    roots,
    salts: [salt],
  };
  logger.debug(`commitmentsInfo.localSiblingPaths :${commitmentsInfo.localSiblingPaths}`);
  logger.debug(`leafIndices :${commitmentsInfo.leafIndices}`);
  logger.debug(`roots :${commitmentsInfo.roots}`);
  // const commitmentsInfo = await getCommitmentInfo({
  //   totalValueToSend,
  //   fee,
  //   recipientZkpPublicKeysArray: recipientZkpPublicKeys,
  //   ercAddress,
  //   maticAddress,
  //   tokenId,
  //   rootKey,
  //   maxNumberNullifiers: VK_IDS.manufacture.numberNullifiers,
  // });

  try {
    // KEM-DEM encryption
    // const [ePrivate, ePublic] = await genEphemeralKeys();
    // const [unpackedTokenID, packedErc] = packSecrets(tokenId, ercAddress, 0, 2);
    // const compressedSecrets = encrypt(generalise(ePrivate), generalise(recipientZkpPublicKeys[0]), [
    //   packedErc.bigInt,
    //   unpackedTokenID.bigInt,
    //   values[0].bigInt,
    //   commitmentsInfo.salts[0].bigInt,
    // ]);

    // Compress the public key as it will be put on-chain
    // const compressedEPub = edwardsCompress(ePublic);

    // now we have everything we need to create a Witness and compute a proof
    const transaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 4,
      //   ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
      //   tokenId: compressedSecrets[1], // this is the encrypted tokenID
      //   recipientAddress: compressedEPub,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      //   compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
      numberNullifiers: 3, // VK_IDS.manufacture.numberNullifiers,
      numberCommitments: 4, //VK_IDS.manufacture.numberCommitments,
      calculateHash: false,
    });

    const privateData = {
      rootKey: commitmentsToUse.map(() => rootKey),
      oldCommitmentPreimage: commitmentsInfo.oldCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      paths: commitmentsInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
      orders: commitmentsInfo.leafIndices,
      newCommitmentPreimage: commitmentsInfo.newCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      recipientPublicKeys: commitmentsInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
      tokenIds: commitmentsInfo.oldCommitments.map(o => o.preimage.tokenId),
      ercAddresses: commitmentsInfo.oldCommitments.map(o => o.preimage.ercAddress),
      recipeIndex,
      outputTokenId,
      outputErcAddress,
      // ephemeralKey: ePrivate,
    };

    const witness = computeManufactureCircuitInputs(
      transaction,
      privateData,
      commitmentsInfo.roots,
      maticAddress,
      3,
      4,
      // VK_IDS.manufacture.numberNullifiers,
      // VK_IDS.manufacture.numberCommitments,
    );
    logger.debug(`witness input is ${witness.join(' ')}`);
    // call a zokrates worker to generate the proof
    const folderpath = 'manufacture';
    const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
      folderpath,
      inputs: witness,
      provingScheme: PROVING_SCHEME,
      backend: BACKEND,
    });
    logger.trace(`Received response ${JSON.stringify(res.data, null, 2)}`);
    const { proof } = res.data;
    // and work out the ABI encoded data that the caller should sign and send to the shield contract

    const optimisticManufactureTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 4,
      // ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
      // tokenId: compressedSecrets[1], // this is the encrypted tokenID
      // recipientAddress: compressedEPub,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      // compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
      proof,
      numberNullifiers: TRANSACTION.numberNullifiers,
      numberCommitments: TRANSACTION.numberCommitments,
    });

    logger.debug(
      `Client made transaction ${JSON.stringify(
        optimisticManufactureTransaction,
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
      markNullified(c, optimisticManufactureTransaction),
    );

    await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);

    const returnObj = { transaction: optimisticManufactureTransaction };

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
            { transaction: optimisticManufactureTransaction },
            { timeout: 3600000 },
          );
        }),
      );
    } else {
      returnObj.rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(optimisticManufactureTransaction))
        .encodeABI();
    }
    return returnObj;
  } catch (error) {
    await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
    throw new Error(error);
  }
}

export default manufacture;
