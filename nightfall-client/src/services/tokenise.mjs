import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';
import { Commitment, Transaction } from '../classes/index.mjs';
import { storeCommitment } from './commitment-storage.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeTokeniseCircuitInputs } from '../utils/computeCircuitInputs.mjs';

const {
  ZOKRATES_WORKER_HOST,
  PROVING_SCHEME,
  BACKEND,
  PROTOCOL,
  BN128_GROUP_ORDER,
  TRANSACTION,
  VK_IDS,
} = config;
const { SHIELD_CONTRACT_NAME } = constants;
const { generalise } = gen;

async function tokenise(items) {
  logger.info('Creating a tokenise transaction');
  // before we do anything else, long hex strings should be generalised to make
  // subsequent manipulations easier
  const { ercAddress, tokenId, value, compressedZkpPublicKey, nullifierKey, fee } =
    generalise(items);
  const zkpPublicKey = ZkpKeys.decompressZkpPublicKey(compressedZkpPublicKey);
  const salt = await randValueLT(BN128_GROUP_ORDER);
  const commitment = new Commitment({ ercAddress, tokenId, value, zkpPublicKey, salt });
  logger.debug(`Hash of new commitment is ${commitment.hash.hex()}`);
  // now we can compute a Witness so that we can generate the proof

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  const publicData = new Transaction({
    fee,
    transactionType: 3,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: [commitment],
    numberNullifiers: VK_IDS.tokenise.numberNullifiers,
    numberCommitments: VK_IDS.tokenise.numberCommitments,
    calculateHash: false,
  });

  const privateData = { value, salt, recipientPublicKeys: [zkpPublicKey], tokenId, ercAddress };

  console.log('NUMBER NULLIFIERS', VK_IDS.tokenise.numberNullifiers);
  console.log('NUMBER COMMITMENTS', VK_IDS.tokenise.numberCommitments);
  const witness = computeTokeniseCircuitInputs(
    publicData,
    privateData,
    [],
    maticAddress,
    VK_IDS.tokenise.numberNullifiers,
    VK_IDS.tokenise.numberCommitments,
  );
  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  const folderpath = 'tokenise';
  const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
    folderpath,
    inputs: witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });
  logger.trace(`Received response ${JSON.stringify(res.data, null, 2)}`);
  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract
  // first, get the contract instance

  // next we need to compute the optimistic Transaction object
  const optimisticTokeniseTransaction = new Transaction({
    fee,
    transactionType: 3,
    tokenType: items.tokenType,
    tokenId,
    value,
    ercAddress,
    commitments: [commitment],
    proof,
    numberNullifiers: TRANSACTION.numberNullifiers,
    numberCommitments: TRANSACTION.numberCommitments,
  });
  logger.trace(
    `Optimistic tokenise transaction ${JSON.stringify(optimisticTokeniseTransaction, null, 2)}`,
  );
  // and then we can create an unsigned blockchain transaction
  try {
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticTokeniseTransaction))
      .encodeABI();
    // store the commitment on successful computation of the transaction
    commitment.isDeposited = true;
    storeCommitment(commitment, nullifierKey);
    return { rawTransaction, transaction: optimisticTokeniseTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default tokenise;
