/* eslint-disable no-await-in-loop */

import config from 'config';
import constants from 'common-files/constants/index.mjs';
import logger from 'common-files/utils/logger.mjs';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import { getCircuitHash, generateProof } from 'common-files/utils/worker-calls.mjs';
import { compressProof } from 'common-files/utils/curve-maths/curves.mjs';
import gen from 'general-number';
import { Commitment, Transaction } from '../classes/index.mjs';
import { clearPending, saveExtendedTransaction } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { ZkpKeys } from './keys.mjs';

const { VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = constants;
const { generalise } = gen;

async function transform(transformParams) {
  logger.info('Creating a transform transaction');

  const { inputTokens, outputTokens, providedCommitmentsFee, ...items } = transformParams;
  const { rootKey, fee } = generalise(items);
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const feeL2TokenAddress = generalise(
    (await shieldContractInstance.methods.getFeeL2TokenAddress().call()).toLowerCase(),
  );

  const circuitHash = await getCircuitHash('transform');

  const commitmentInfoArray = [];
  for (const token of inputTokens) {
    // we don't need to rely on the user value here and could also hard code it to 1
    const ci = await getCommitmentInfo({
      totalValueToSend: generalise(token.value).bigInt,
      ercAddress: generalise(token.address.toLowerCase()),
      tokenId: generalise(token.id),
      feeL2TokenAddress,
      rootKey,
      providedCommitments: [token.commitmentHash],
    });

    if (ci.oldCommitments.length !== 1) throw Error('retrieved incorrect number of commitments');
    // we don't want any new commitments because we don't care about the change
    ci.newCommitments = [];
    commitmentInfoArray.push(ci);
  }

  const feeCi = await getCommitmentInfo({
    totalValueToSend: 0n,
    fee,
    ercAddress: generalise(0),
    feeL2TokenAddress,
    rootKey,
    maxNullifiers: VK_IDS.transform.numberNullifiers - inputTokens.length,
    maxNonFeeNullifiers: 0,
    providedCommitmentsFee,
  });
  commitmentInfoArray.push(feeCi);
  const paddedInputTokens = [
    ...inputTokens,
    ...Array(feeCi.nullifiers.length).fill({ address: feeL2TokenAddress, id: 0 }),
  ];

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
  commitmentInfoArray.forEach(ci => {
    for (const attr in ci) {
      if (Object.prototype.hasOwnProperty.call(commitmentInfo, attr))
        commitmentInfo[attr].push(...ci[attr]);
    }
  });

  // add a new commitment for each output token
  const outputCommitments = [];
  for (let i = 0; i < outputTokens.length; i++) {
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
  commitmentInfo.newCommitments = [...outputCommitments, ...commitmentInfo.newCommitments];
  const paddedOutputTokens = [...outputTokens, { address: feeL2TokenAddress, id: 0 }];

  try {
    logger.debug('creating transaction...');
    logger.debug(commitmentInfo);

    // now we have everything we need to create a Witness and compute a proof
    const publicData = new Transaction({
      fee: fee.hex(32),
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
      inputTokens: paddedInputTokens,
      outputTokens: paddedOutputTokens,
    };

    logger.debug('computing witness...');
    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentInfo.roots,
      feeL2TokenAddress,
      VK_IDS.transform.numberNullifiers,
      VK_IDS.transform.numberCommitments,
    );

    logger.debug({
      msg: 'witness input is',
      witness,
    });

    // call a worker to generate the proof
    const res = await generateProof({ folderpath: 'transform', witness });

    logger.debug({
      msg: 'Received response from generate-proof',
      response: res.data,
    });

    const { proof } = res.data;

    const transaction = { ...publicData, proof: compressProof(proof) };
    transaction.transactionHash = Transaction.calcHash(transaction);

    logger.debug({
      msg: `Client made Transform`,
      transaction,
    });

    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(transaction))
      .encodeABI();

    await saveExtendedTransaction(
      transaction,
      commitmentInfo,
      compressedZkpPublicKey,
      nullifierKey,
      true, // offchain
    );

    return { rawTransaction, transaction };
  } catch (error) {
    await Promise.all(commitmentInfo.oldCommitments.map(o => clearPending(o)));
    throw error;
  }
}

export default transform;
