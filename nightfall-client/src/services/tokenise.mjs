import axios from 'axios';
import config from 'config';
import constants from 'common-files/constants/index.mjs';
import logger from 'common-files/utils/logger.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import gen from 'general-number';
import { ZkpKeys } from './keys.mjs';
import { Commitment, Transaction } from '../classes/index.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { clearPending } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { submitTransaction } from '../utils/submitTransaction.mjs';

const { ZOKRATES_WORKER_HOST, PROVING_SCHEME, BACKEND, PROTOCOL, VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = constants;
const { generalise } = gen;

async function tokenise(items) {
  logger.info('Creating a tokenise transaction');
  const {
    offchain = false,
    ercAddress,
    salt = await randValueLT(BN128_GROUP_ORDER),
    compressedZkpPublicKey,
    rootKey,
    tokenId = 0,
    compressedSecrets = undefined,
    fee,
  } = generalise(items);

  const zkpPublicKey = ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey);
  const commitment = new Commitment({ ercAddress, tokenId, value: 0, zkpPublicKey, salt });

  logger.debug({
    msg: 'Hash of new commitment',
    hash: commitment.hash.hex(),
  });

  // now we can compute a Witness so that we can generate the proof
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend: 0n,
    fee,
    ercAddress: generalise(0),
    maticAddress,
    rootKey,
    maxNumberNullifiers: VK_IDS.tokenise.numberNullifiers,
    onlyFee: true,
  });

  try {
    const publicData = new Transaction({
      fee,
      tokenId,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 3,
      commitments: [commitment, ...commitmentsInfo.newCommitments],
      nullifiers: commitmentsInfo.nullifiers,
      compressedSecrets,
      numberNullifiers: VK_IDS.tokenise.numberNullifiers,
      numberCommitments: VK_IDS.tokenise.numberCommitments,
    });

    const privateData = {
      rootKey,
      oldCommitmentPreimage: commitmentsInfo.oldCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),

      paths: commitmentsInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
      orders: commitmentsInfo.leafIndices,
      newCommitmentPreimage: [
        { value: 0, salt },
        ...commitmentsInfo.newCommitments.map(o => {
          return { value: o.preimage.value, salt: o.preimage.salt };
        }),
      ],
      recipientPublicKeys: [
        zkpPublicKey,
        ...commitmentsInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
      ],
      ercAddress,
      tokenId,
    };
    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentsInfo.roots,
      maticAddress,
      VK_IDS.tokenise.numberNullifiers,
      VK_IDS.tokenise.numberCommitments,
    );

    logger.debug({
      msg: 'witness input is',
      witness: witness.join(' '),
    });

    const folderpath = 'tokenise';
    const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
      folderpath,
      inputs: witness,
      provingScheme: PROVING_SCHEME,
      backend: BACKEND,
    });

    logger.trace({
      msg: 'Received response from generate-proof',
      response: JSON.stringify(res.data, null, 2),
    });

    const { proof } = res.data;

    const optimisticTokeniseTransaction = new Transaction({
      fee,
      tokenId,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 3,
      commitments: [commitment, ...commitmentsInfo.newCommitments],
      nullifiers: commitmentsInfo.nullifiers,
      compressedSecrets,
      proof,
      numberNullifiers: VK_IDS.tokenise.numberNullifiers,
      numberCommitments: VK_IDS.tokenise.numberCommitments,
    });

    logger.debug({
      msg: 'Client made transaction',
      transaction: JSON.stringify(optimisticTokeniseTransaction, null, 2),
      offchain,
    });

    return submitTransaction(
      optimisticTokeniseTransaction,
      commitmentsInfo,
      rootKey,
      shieldContractInstance,
      offchain,
    );
  } catch (error) {
    await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
    throw new Error(error);
  }
}

export default tokenise;
