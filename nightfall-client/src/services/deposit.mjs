/**
 * This module contains the logic needed create a zkp deposit, i.e. to pay
 * a token to the Shield contract and have it create a zkp commitment for the
 * same value. It is agnostic to whether we are dealing with an ERC20 or ERC721
 * (or ERC1155).
 * @module deposit.mjs
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import gen from 'general-number';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import {
  waitForContract,
  getFeeL2TokenAddress,
} from '@polygon-nightfall/common-files/utils/contract.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { compressProof } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import {
  getCircuitHash,
  generateProof,
} from '@polygon-nightfall/common-files/utils/worker-calls.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { Commitment, Transaction } from '../classes/index.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { submitTransaction } from '../utils/submitTransaction.mjs';
import { getCommitmentByHash } from './commitment-storage.mjs';

const { VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER, DEPOSIT, DEPOSIT_FEE } = constants;
const { generalise } = gen;

/**
 * Does some sort of treatment and validations in the parameters so that they can be used properly
 */
async function getDepositParams(depositParams) {
  const { tokenType, providedCommitmentsFee, ...items } = depositParams;

  // before we do anything else, long hex strings should be generalised to make subsequent manipulations easier
  const generalisedItems = generalise(items);
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(generalisedItems.rootKey);

  return {
    tokenType,
    providedCommitmentsFee,
    ercAddress: generalise(items.ercAddress.toLowerCase()),
    salt: generalisedItems.salt ?? (await randValueLT(BN128_GROUP_ORDER)).hex(),
    tokenId: generalisedItems.tokenId,
    value: generalisedItems.value,
    fee: generalisedItems.fee,
    rootKey: generalisedItems.rootKey,
    compressedZkpPublicKey,
    nullifierKey,
    zkpPublicKey: ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey),
    feeL2TokenAddress: await getFeeL2TokenAddress(),
  };
}

/**
 * Does some checks and returns the data needed for doing a deposit
 */
async function getDepositData(
  fee,
  feeL2TokenAddress,
  providedCommitmentsFee,
  value,
  tokenId,
  ercAddress,
  rootKey,
  zkpPublicKey,
  salt,
) {
  let valueNewCommitment = value;

  let commitmentsInfo = {
    oldCommitments: [],
    nullifiers: [],
    newCommitments: [],
    localSiblingPaths: [],
    leafIndices: [],
    blockNumberL2s: [],
    roots: [],
    salts: [],
  };

  let circuitName = DEPOSIT_FEE;

  if (fee.bigInt > 0) {
    if (feeL2TokenAddress.hex(32) === ercAddress.hex(32)) {
      if (value.bigInt <= fee.bigInt) {
        throw new Error('Value deposited needs to be greater than the fee');
      }

      valueNewCommitment = generalise(value.bigInt - fee.bigInt);
      circuitName = DEPOSIT;
    } else {
      commitmentsInfo = await getCommitmentInfo({
        totalValueToSend: 0n,
        fee,
        ercAddress,
        feeL2TokenAddress,
        rootKey,
        maxNullifiers: VK_IDS[circuitName].numberNullifiers,
        maxNonFeeNullifiers: 0,
        providedCommitmentsFee,
      });
    }
  } else {
    circuitName = DEPOSIT;
  }

  let commitment = new Commitment({
    ercAddress,
    tokenId,
    value: valueNewCommitment,
    zkpPublicKey,
    salt,
  });

  // Mark the commitment as deposited
  commitment.isDeposited = true;

  // Prepend the new tokenised commitment
  // TODO remove after tests
  // commitmentsInfo.newCommitments = [commitment, ...commitmentsInfo.newCommitments];

  logger.debug({
    msg: 'Hash of new commitment',
    hash: commitment.hash.hex(),
  });

  const dbQueriedCommitment = await getCommitmentByHash(commitment);
  if (dbQueriedCommitment) {
    if (dbQueriedCommitment.isOnChain !== -1) {
      throw new Error('You can not re-send a commitment that is already on-chain');
    }
    commitment = dbQueriedCommitment;
  }

  // Prepend the new tokenised commitment
  commitmentsInfo.newCommitments = [commitment, ...commitmentsInfo.newCommitments];

  return {
    commitmentsInfo,
    circuitHash: await getCircuitHash(circuitName),
    circuitName,
  };
}

/**
 * Generates the compressed proof for the deposit
 */
async function generateDepositProof(
  commitmentsInfo,
  publicData,
  feeL2TokenAddress,
  circuitName,
  rootKey,
) {
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

  return compressProof(proof);
}

/**
 * Performs a deposit from an Ethereum Account to a Nightfall Account.
 */
async function deposit(depositParams) {
  logger.info('Creating a deposit transaction');

  const {
    tokenType,
    providedCommitmentsFee,
    ercAddress,
    salt,
    tokenId,
    value,
    fee,
    rootKey,
    compressedZkpPublicKey,
    nullifierKey,
    zkpPublicKey,
    feeL2TokenAddress,
  } = await getDepositParams(depositParams);

  const { commitmentsInfo, circuitHash, circuitName } = await getDepositData(
    fee,
    feeL2TokenAddress,
    providedCommitmentsFee,
    value,
    tokenId,
    ercAddress,
    rootKey,
    zkpPublicKey,
    salt,
  );

  const publicData = new Transaction({
    fee,
    historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
    circuitHash,
    tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: commitmentsInfo.newCommitments,
    nullifiers: commitmentsInfo.nullifiers,
    numberNullifiers: VK_IDS[circuitName].numberNullifiers,
    numberCommitments: VK_IDS[circuitName].numberCommitments,
    isOnlyL2: false,
  });

  const proof = await generateDepositProof(
    commitmentsInfo,
    publicData,
    feeL2TokenAddress,
    circuitName,
    rootKey,
  );

  // next we need to compute the optimistic Transaction object
  const transaction = { ...publicData, proof };
  transaction.transactionHash = Transaction.calcHash(transaction);

  logger.debug({
    msg: `Client made ${circuitName}`,
    transaction,
  });

  // and then we can create an unsigned blockchain transaction
  try {
    const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

    // store the commitment on successful computation of the transaction
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(transaction))
      .encodeABI();

    await submitTransaction(
      transaction,
      commitmentsInfo,
      compressedZkpPublicKey,
      nullifierKey,
      false,
    );

    return { rawTransaction, transaction };
  } catch (err) {
    logger.error(err);
    throw err; // let the caller handle the error
  }
}

export default deposit;
