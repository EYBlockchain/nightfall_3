/* eslint-disable no-await-in-loop */

import axios from 'axios';
import config from 'config';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import gen from 'general-number';
import { Commitment, Transaction } from '../classes/index.mjs';
import { clearPending } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { submitTransaction } from '../utils/submitTransaction.mjs';
import { ZkpKeys } from './keys.mjs';

const { CIRCOM_WORKER_HOST, PROVING_SCHEME, BACKEND, PROTOCOL } = config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER, VK_IDS } = constants;
const { generalise } = gen;

async function transform(transformParams) {
  logger.info('Creating a transform transaction');

  const { tokenInputs, tokenOutputs, ...items } = transformParams;
  const { rootKey, fee } = generalise(items);

  const { zkpPublicKey } = new ZkpKeys(rootKey);
  console.log(zkpPublicKey);

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  // get commitment info for every token Input
  const commitmentInfoArray = [];
  for (const tokenInput of tokenInputs) {
    const ci = await getCommitmentInfo({
      totalValueToSend: generalise(tokenInput.value).bigInt,
      fee: generalise(0),
      ercAddress: generalise(tokenInput.ercAddress),
      tokenId: generalise(tokenInput.tokenId),
      maticAddress,
      rootKey,
      maxNumberNullifiers: 1,
    });
    commitmentInfoArray.push(ci);
  }

  // TODO: what do we do if we don't have 2 inputs?

  logger.debug('getting fee commitments');
  commitmentInfoArray.push(
    await getCommitmentInfo({
      totalValueToSend: 0n,
      fee,
      ercAddress: maticAddress,
      tokenId: generalise(0),
      maticAddress,
      rootKey,
      maxNumberNullifiers: 1,
      feeOnly: true,
    }),
  );

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
    for (const attr in commitmentInfo) {
      if (Object.prototype.hasOwnProperty.call(commitmentInfo, attr))
        commitmentInfo[attr].push(...ci[attr]);
    }
  });

  logger.debug({
    msg: 'comparing public keys',
    zkpPublicKey,
    commitmentInfoKey: commitmentInfo.newCommitments[0].preimage.zkpPublicKey,
  });
  // add a new commitment for each output token
  for (const tokenOutput of tokenOutputs) {
    const commitment = new Commitment({
      ercAddress: tokenOutput.ercAddress,
      tokenId: tokenOutput.tokenId,
      value: tokenOutput.value,
      zkpPublicKey: commitmentInfo.newCommitments[0].preimage.zkpPublicKey,
      salt: (await randValueLT(BN128_GROUP_ORDER)).hex(),
    });
    logger.debug({ msg: 'output commitment', commitment });
    commitmentInfo.newCommitments.push(commitment);
  }

  try {
    logger.debug('creating transaction...');

    // now we have everything we need to create a Witness and compute a proof
    const publicData = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentInfo.blockNumberL2s,
      circuitHash: 0,
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
      tokenInputs,
      tokenOutputs,
    };
    logger.debug(privateData.newCommitmentPreimage);

    logger.debug('computing witness...');
    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentInfo.roots,
      maticAddress,
      VK_IDS.transfer.numberNullifiers,
      VK_IDS.transfer.numberCommitments,
    );

    logger.debug({
      msg: 'witness input is',
      witness: JSON.stringify(witness, 0, 2),
    });

    // call a worker to generate the proof
    const folderpath = 'transform';
    const res = await axios
      .post(`${PROTOCOL}${CIRCOM_WORKER_HOST}/generate-proof`, {
        folderpath,
        inputs: witness,
        provingScheme: PROVING_SCHEME,
        backend: BACKEND,
      })
      .catch(e => logger.debug({ msg: 'proof generation failed', e }));

    logger.debug({
      msg: 'Received response from generate-proof',
      response: JSON.stringify(res.data, null, 2),
    });

    const { proof } = res.data;
    // and work out the ABI encoded data that the caller should sign and send to the shield contract

    const optimisticTransformTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentInfo.blockNumberL2s,
      transactionType: VK_IDS.transform.txType,
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
