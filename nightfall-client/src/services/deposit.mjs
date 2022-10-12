/**
 * This module contains the logic needed create a zkp deposit, i.e. to pay
 * a token to the Shield contract and have it create a zkp commitment for the
 * same value. It is agnostic to whether we are dealing with an ERC20 or ERC721
 * (or ERC1155).
 * @module deposit.mjs
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { Commitment, Transaction } from '../classes/index.mjs';
import { storeCommitment } from './commitment-storage.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';

const { ZOKRATES_WORKER_HOST, PROVING_SCHEME, BACKEND, PROTOCOL, USE_STUBS, VK_IDS } = config;
const { SHIELD_CONTRACT_NAME, BN128_GROUP_ORDER } = constants;
const { generalise } = gen;

async function deposit(items) {
  logger.info('Creating a deposit transaction');

  // before we do anything else, long hex strings should be generalised to make subsequent manipulations easier
  const { tokenId, value, compressedZkpPublicKey, nullifierKey } = generalise(items);
  const ercAddress = generalise(items.ercAddress.toLowerCase());
  const zkpPublicKey = ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey);
  const salt = await randValueLT(BN128_GROUP_ORDER);
  const commitment = new Commitment({ ercAddress, tokenId, value, zkpPublicKey, salt });

  logger.debug({
    msg: 'Hash of new commitment',
    hash: commitment.hash.hex(),
  });

  // now we can compute a Witness so that we can generate the proof
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const publicData = new Transaction({
    fee: 0,
    transactionType: 0,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: [commitment],
    numberNullifiers: VK_IDS.deposit.numberNullifiers,
    numberCommitments: VK_IDS.deposit.numberCommitments,
  });

  const privateData = { salt, recipientPublicKeys: [zkpPublicKey] };

  const witness = computeCircuitInputs(
    publicData,
    privateData,
    [],
    maticAddress,
    VK_IDS.deposit.numberNullifiers,
    VK_IDS.deposit.numberCommitments,
  );
  logger.debug({
    msg: 'witness input is',
    witness: witness.join(' '),
  });
  // call a zokrates worker to generate the proof
  let folderpath = 'deposit';
  if (USE_STUBS) folderpath = `${folderpath}_stub`;
  const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
    folderpath,
    inputs: witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });

  logger.trace({
    msg: 'Received response from generete-proof',
    response: res.data,
  });

  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  // first, get the contract instance

  // next we need to compute the optimistic Transaction object
  const optimisticDepositTransaction = new Transaction({
    fee: 0,
    transactionType: 0,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: [commitment],
    proof,
    numberNullifiers: VK_IDS.deposit.numberNullifiers,
    numberCommitments: VK_IDS.deposit.numberCommitments,
  });

  logger.trace({
    optimisticDepositTransaction,
  });

  // and then we can create an unsigned blockchain transaction
  try {
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticDepositTransaction))
      .encodeABI();
    // store the commitment on successful computation of the transaction
    commitment.isDeposited = true;
    storeCommitment(commitment, nullifierKey);
    return { rawTransaction, transaction: optimisticDepositTransaction };
  } catch (err) {
    logger.error(err);
    throw err; // let the caller handle the error
  }
}

export default deposit;
