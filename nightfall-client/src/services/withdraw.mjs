/**
 * This module contains the logic needed create a zkp transfer, i.e. to nullify
 * two input commitments and create two new output commitments to the same value.
 * It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import gen from 'general-number';
import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import { compressProof } from 'common-files/utils/curve-maths/curves.mjs';
import { getCircuitHash, generateProof } from 'common-files/utils/worker-calls.mjs';
import { Transaction } from '../classes/index.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { clearPending, saveExtendedTransaction } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { ZkpKeys } from './keys.mjs';

const { VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, WITHDRAW } = constants;
const { generalise } = gen;

const MAX_WITHDRAW = 5192296858534827628530496329220096n; // 2n**112n

async function withdraw(withdrawParams) {
  logger.info('Creating a withdraw transaction');
  // let's extract the input items
  const {
    offchain = false,
    providedCommitments,
    providedCommitmentsFee,
    ...items
  } = withdrawParams;
  const { tokenId, value, recipientAddress, rootKey, fee } = generalise(items);
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);
  const ercAddress = generalise(items.ercAddress.toLowerCase());
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const feeL2TokenAddress = generalise(
    (await shieldContractInstance.methods.getFeeL2TokenAddress().call()).toLowerCase(),
  );

  logger.debug({
    msg: 'Withdraw ERC Token and Fee addresses',
    ercAddress: ercAddress.hex(32),
    feeL2TokenAddress: feeL2TokenAddress.hex(32),
  });

  const withdrawValue = value.bigInt > MAX_WITHDRAW ? MAX_WITHDRAW : value.bigInt;

  const circuitName = WITHDRAW;

  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend: withdrawValue,
    fee,
    ercAddress,
    feeL2TokenAddress,
    tokenId,
    rootKey,
    maxNullifiers: VK_IDS[circuitName].numberNullifiers,
    providedCommitments,
    providedCommitmentsFee,
  });

  try {
    const circuitHash = await getCircuitHash(circuitName);

    // now we have everything we need to create a Witness and compute a proof
    const publicData = new Transaction({
      fee: fee.hex(32),
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      circuitHash,
      tokenType: items.tokenType,
      tokenId: tokenId.hex(32),
      value: value.hex(32),
      ercAddress: ercAddress.hex(32),
      recipientAddress: recipientAddress.hex(32),
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      numberNullifiers: VK_IDS[circuitName].numberNullifiers,
      numberCommitments: VK_IDS[circuitName].numberCommitments,
      isOnlyL2: false,
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

    // call a worker to generate the proof
    const res = await generateProof({ folderpath: circuitName, witness });

    logger.trace({
      msg: 'Received response from generate-proof',
      response: res.data,
    });

    const { proof } = res.data;
    // and work out the ABI encoded data that the caller should sign and send to the shield contract
    const transaction = { ...publicData, proof: compressProof(proof) };
    transaction.transactionHash = Transaction.calcHash(transaction);

    logger.debug({
      msg: `Client made ${circuitName}`,
      transaction,
      offchain,
    });

    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(transaction))
      .encodeABI();
    await saveExtendedTransaction(
      transaction,
      commitmentsInfo,
      compressedZkpPublicKey,
      nullifierKey,
      offchain,
    );
    return { rawTransaction, transaction };
  } catch (error) {
    await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
    logger.error(error);
    throw error;
  }
}

export default withdraw;
