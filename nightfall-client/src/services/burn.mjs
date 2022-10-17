import axios from 'axios';
import config from 'config';
import constants from 'common-files/constants/index.mjs';
import logger from 'common-files/utils/logger.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import gen from 'general-number';
import Transaction from 'common-files/classes/transaction.mjs';
import { clearPending } from './commitment-storage.mjs';
import Commitment from '../classes/commitment.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { submitTransaction } from '../utils/submitTransaction.mjs';

const { ZOKRATES_WORKER_HOST, PROVING_SCHEME, BACKEND, PROTOCOL, VK_IDS } = config;
const { SHIELD_CONTRACT_NAME } = constants;
const { generalise } = gen;

async function burn(burnParams) {
  logger.info('Creating a burn transaction');
  // let's extract the input items
  const { offchain = false, ...items } = burnParams;
  const { providedCommitments, rootKey, fee } = generalise(items);

  // TODO: THIS LINE IS WRONG
  const commitment = new Commitment(providedCommitments);

  // now we can compute a Witness so that we can generate the proof
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend: 0,
    fee,
    ercAddress: 0,
    maticAddress,
    tokenId: 0,
    rootKey,
    maxNumberNullifiers: VK_IDS.burn.numberNullifiers,
    onlyFee: true,
  });

  try {
    const publicData = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 4,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      numberNullifiers: VK_IDS.burn.numberNullifiers,
      numberCommitments: VK_IDS.burn.numberCommitments,
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
      ercAddress: commitment.preimage.ercAddress,
      tokenId: commitment.preimage.tokenId,
    };

    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentsInfo.roots,
      maticAddress,
      VK_IDS.burn.numberNullifiers,
      VK_IDS.burn.numberCommitments,
    );

    logger.debug({
      msg: 'witness input is',
      witness: witness.join(' '),
    });

    const folderpath = 'burn';
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

    const optimisticBurnTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      transactionType: 4,
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      proof,
      numberNullifiers: VK_IDS.burn.numberNullifiers,
      numberCommitments: VK_IDS.burn.numberCommitments,
    });

    logger.debug({
      msg: 'Client made transaction',
      transaction: JSON.stringify(optimisticBurnTransaction, null, 2),
      offchain,
    });

    return submitTransaction(
      optimisticBurnTransaction,
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

export default burn;
