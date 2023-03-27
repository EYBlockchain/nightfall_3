import config from 'config';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import {
  getCircuitHash,
  generateProof,
} from '@polygon-nightfall/common-files/utils/worker-calls.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import { compressProof } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import gen from 'general-number';
import { ZkpKeys } from './keys.mjs';
import { Commitment, Transaction } from '../classes/index.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { clearPending, saveExtendedTransaction } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';

const { VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER, TOKENISE } = constants;
const { generalise } = gen;

async function tokenise(items) {
  logger.info('Creating a tokenise transaction');
  const { providedCommitmentsFee } = items;
  const {
    salt = (await randValueLT(BN128_GROUP_ORDER)).hex(),
    value = 0,
    rootKey,
    tokenId = 0,
    fee,
  } = generalise(items);
  const ercAddress = generalise(items.ercAddress.toLowerCase());
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);
  const zkpPublicKey = ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey);
  const commitment = new Commitment({ ercAddress, tokenId, value, zkpPublicKey, salt });

  logger.debug({
    msg: 'Hash of new commitment',
    hash: commitment.hash.hex(),
  });

  // now we can compute a Witness so that we can generate the proof
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const feeL2TokenAddress = generalise(
    (await shieldContractInstance.methods.getFeeL2TokenAddress().call()).toLowerCase(),
  );

  const circuitName = TOKENISE;

  // Currently just the fee commitments
  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend: 0n,
    fee,
    ercAddress,
    feeL2TokenAddress,
    rootKey,
    maxNullifiers: VK_IDS[circuitName].numberNullifiers,
    maxNonFeeNullifiers: 0,
    providedCommitmentsFee,
  });

  const circuitHash = await getCircuitHash(circuitName);

  // Prepend the new tokenised commitment
  commitmentsInfo.newCommitments = [commitment, ...commitmentsInfo.newCommitments];

  try {
    const publicData = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      circuitHash,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      numberNullifiers: VK_IDS[circuitName].numberNullifiers,
      numberCommitments: VK_IDS[circuitName].numberCommitments,
      isOnlyL2: true,
    });

    const privateData = {
      rootKey,
      oldCommitmentPreimage: commitmentsInfo.oldCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),

      paths: commitmentsInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
      orders: commitmentsInfo.leafIndices,
      newCommitmentPreimage: commitmentsInfo.newCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),

      recipientPublicKeys: commitmentsInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
      ercAddress,
      tokenId,
      value,
    };
    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentsInfo.roots,
      feeL2TokenAddress,
      VK_IDS[circuitName].numberNullifiers,
      VK_IDS[circuitName].numberCommitments,
    );

    logger.debug({
      msg: 'witness input is',
      witness,
    });

    const res = await generateProof({ folderpath: circuitName, witness });

    logger.trace({
      msg: 'Received response from generate-proof',
      response: res.data,
    });

    const { proof } = res.data;

    const transaction = { ...publicData, proof: compressProof(proof) };
    transaction.transactionHash = Transaction.calcHash(transaction);

    logger.debug({
      msg: `Client made ${circuitName}`,
      transaction,
    });

    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(transaction))
      .encodeABI();
    await saveExtendedTransaction(
      transaction,
      commitmentsInfo,
      compressedZkpPublicKey,
      nullifierKey,
      true,
    );
    return { rawTransaction, transaction };
  } catch (error) {
    await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
    logger.error(error);
    throw error;
  }
}

export default tokenise;
