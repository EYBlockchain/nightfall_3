/* eslint-disable no-await-in-loop */

import config from 'config';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import {
  getCircuitHash,
  generateProof,
} from '@polygon-nightfall/common-files/utils/worker-calls.mjs';
import utils from '@polygon-nightfall/common-files/utils/crypto/merkle-tree/utils.mjs';
import gen from 'general-number';
import { Commitment, Transaction } from '../classes/index.mjs';
import { clearPending } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { submitTransaction } from '../utils/submitTransaction.mjs';
import { ZkpKeys } from './keys.mjs';

const { VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = constants;
const { generalise } = gen;

async function transform(transformParams) {
  logger.info('Creating a transform transaction');

  const { inputTokens, outputTokens, ...items } = transformParams;
  const { rootKey, compressedZkpPublicKey, fee } = generalise(items);

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const circuitHash = await getCircuitHash('transform');

  // the last two nullifiers are reserverd for covering the fee
  // the last commitment is reserved for paying the fee change
  // we modify the commitmentInfo result to preserve this order
  const commitmentInfoArray = [];
  for (const token of inputTokens) {
    // we don't need to rely on the user value here and could also hard code it to 1
    const ci = await getCommitmentInfo({
      totalValueToSend: generalise(token.value).bigInt,
      ercAddress: generalise(token.address.toLowerCase()),
      tokenId: generalise(token.id),
      maticAddress,
      rootKey,
      providedCommitments: [token.commitmentHash],
    });

    if (ci.oldCommitments.length !== 1) throw Error('retrieved incorrect number of commitments');
    // we don't want any new commitments because we don't care about the change
    ci.newCommitments = [];
    commitmentInfoArray.push(ci);
  }

  const numberInputCommitments = VK_IDS.transform.numberNullifiers - 2;
  if (commitmentInfoArray.length > numberInputCommitments)
    throw Error('too many input commitments');

  const zeroCommitmentInfo = {
    oldCommitments: [
      generalise({
        hash: 0,
        preimage: { value: 0, salt: 0, zkpPublicKey: [0, 0] },
      }),
    ],
    nullifiers: [
      generalise({
        hash: 0,
        preimage: { nullifierKey: 0, commitment: 0 },
      }),
    ],
    localSiblingPaths: [Array(33).fill(0)],
    leafIndices: [0],
    blockNumberL2s: [0],
    roots: [0],
  };
  const paddedCommitmentInfoArray = utils.padArray(
    commitmentInfoArray,
    zeroCommitmentInfo,
    numberInputCommitments,
  );

  const feeCi = await getCommitmentInfo({
    totalValueToSend: 0n,
    fee,
    ercAddress: generalise(0),
    maticAddress,
    rootKey,
    maxNullifiers: 2,
    maxNonFeeNullifiers: 0,
  });
  feeCi.newCommitments = utils.padArray(
    feeCi.newCommitments,
    zeroCommitmentInfo.oldCommitments[0],
    1,
  );
  paddedCommitmentInfoArray.push(feeCi);

  const commitmentInfo = {
    oldCommitments: [],
    nullifiers: [],
    newCommitments: [],
    localSiblingPaths: [],
    leafIndices: [],
    blockNumberL2s: [],
    roots: [],
    salts: [],
  };

  logger.debug('merging commitment infos');
  paddedCommitmentInfoArray.forEach(ci => {
    for (const attr in ci) {
      if (Object.prototype.hasOwnProperty.call(commitmentInfo, attr))
        commitmentInfo[attr].push(...ci[attr]);
    }
  });

  // add a new commitment for each output token
  const outputCommitments = [];
  for (let i = 0; i < VK_IDS.transform.numberCommitments - 1; i++) {
    if (outputTokens.length <= i) {
      outputCommitments.push({
        compressedZkpPublicKey: generalise(0),
        ...zeroCommitmentInfo.oldCommitments[0],
      });
    } else {
      const token = outputTokens[i];
      const commitment = new Commitment({
        ercAddress: generalise(token.address.toLowerCase()),
        tokenId: generalise(token.id),
        value: generalise(token.value),
        zkpPublicKey: ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey),
        salt: token.salt ? token.salt : (await randValueLT(BN128_GROUP_ORDER)).hex(),
      });
      outputCommitments.push(commitment);
    }
  }
  commitmentInfo.newCommitments = [...outputCommitments, ...commitmentInfo.newCommitments];

  try {
    logger.debug('creating transaction...');
    logger.debug(commitmentInfo);

    // now we have everything we need to create a Witness and compute a proof
    const publicData = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentInfo.blockNumberL2s,
      circuitHash,
      commitments: commitmentInfo.newCommitments,
      nullifiers: commitmentInfo.nullifiers,
      numberNullifiers: VK_IDS.transform.numberNullifiers,
      numberCommitments: VK_IDS.transform.numberCommitments,
      isOnlyL2: true,
    });

    logger.debug('creating private data...');
    const privateData = {
      rootKey,
      oldCommitmentPreimage: commitmentInfo.oldCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),

      paths: commitmentInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
      orders: commitmentInfo.leafIndices,
      newCommitmentPreimage: commitmentInfo.newCommitments.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),

      recipientPublicKeys: commitmentInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
      inputTokens,
      outputTokens,
    };

    logger.debug('computing witness...');
    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentInfo.roots,
      maticAddress,
      VK_IDS.transform.numberNullifiers,
      VK_IDS.transform.numberCommitments,
    );

    logger.debug({
      msg: 'witness input is',
      witness: JSON.stringify(witness, 0, 2),
    });

    // call a worker to generate the proof
    const res = await generateProof({ folderpath: 'transform', witness });

    logger.debug({
      msg: 'Received response from generate-proof',
      response: JSON.stringify(res.data, null, 2),
    });

    const { proof } = res.data;
    // and work out the ABI encoded data that the caller should sign and send to the shield contract

    const optimisticTransformTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentInfo.blockNumberL2s,
      circuitHash,
      commitments: commitmentInfo.newCommitments,
      nullifiers: commitmentInfo.nullifiers,
      proof,
      numberNullifiers: VK_IDS.transform.numberNullifiers,
      numberCommitments: VK_IDS.transform.numberCommitments,
      isOnlyL2: true,
    });

    logger.debug({
      msg: 'Client made transaction',
      transaction: JSON.stringify(optimisticTransformTransaction, null, 2),
    });

    return submitTransaction(
      optimisticTransformTransaction,
      commitmentInfo,
      rootKey,
      shieldContractInstance,
      true, // offchain
    );
  } catch (error) {
    await Promise.all(commitmentInfo.oldCommitments.map(o => clearPending(o)));
    throw new Error(error);
  }
}

export default transform;
