import config from 'config';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import {
  getCircuitHash,
  generateProof,
} from '@polygon-nightfall/common-files/utils/worker-calls.mjs';
import gen from 'general-number';
import Transaction from '@polygon-nightfall/common-files/classes/transaction.mjs';
import { compressProof } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import { clearPending } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { submitTransaction } from '../utils/submitTransaction.mjs';
import { ZkpKeys } from './keys.mjs';

const { VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, BURN } = constants;
const { generalise } = gen;

async function burn(burnParams) {
  logger.info('Creating a burn transaction');
  // let's extract the input items
  const { providedCommitments, providedCommitmentsFee, ...items } = burnParams;
  const { rootKey, value, fee, tokenId } = generalise(items);
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);
  const ercAddress = generalise(items.ercAddress.toLowerCase());

  // now we can compute a Witness so that we can generate the proof
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const circuitName = BURN;

  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend: generalise(value).bigInt,
    fee,
    ercAddress,
    tokenId,
    maticAddress,
    rootKey,
    maxNullifiers: VK_IDS[circuitName].numberNullifiers,
    maxNonFeeNullifiers: 1,
    providedCommitments,
    providedCommitmentsFee,
  });

  const circuitHash = await getCircuitHash(circuitName);

  // Burn will have two commitments. The first will belong to the change if commitment isn't fully burnt, and the second one to the fee.
  // Therefore, we need to make sure that if the commitment was completely burn we still keep this order.
  const newCommitmentsCircuit = [...commitmentsInfo.newCommitments];
  if (!commitmentsInfo.hasChange && commitmentsInfo.hasChangeFee) {
    newCommitmentsCircuit.unshift({
      hash: 0,
      preimage: { value: 0, salt: 0, zkpPublicKey: [0, 0] },
    });
  }

  try {
    const publicData = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      circuitHash,
      commitments: newCommitmentsCircuit,
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
      newCommitmentPreimage: newCommitmentsCircuit.map(o => {
        return { value: o.preimage.value, salt: o.preimage.salt };
      }),
      recipientPublicKeys: newCommitmentsCircuit.map(o => o.preimage.zkpPublicKey),
      ercAddress,
      tokenId,
      value,
    };

    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentsInfo.roots,
      maticAddress,
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
    await submitTransaction(
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

export default burn;
