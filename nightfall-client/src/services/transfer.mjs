/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import logger from 'common-files/utils/logger.mjs';
import { edwardsCompress } from 'common-files/utils/curve-maths/curves.mjs';
import constants from 'common-files/constants/index.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { getCommitmentsValues } from '../utils/getCommitmentValues.mjs';
import { encrypt, genEphemeralKeys, packSecrets } from './kem-dem.mjs';
import { updateCommitments } from '../utils/updateCommitments.mjs';

const { ZOKRATES_WORKER_HOST, PROVING_SCHEME, BACKEND, PROTOCOL, USE_STUBS } = config;
const { SHIELD_CONTRACT_NAME } = constants;
const { generalise } = gen;

async function transfer(transferParams) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { offchain = false, ...items } = transferParams;
  const { ercAddress, tokenId, recipientData, rootKey, fee } = generalise(items);
  const { recipientCompressedZkpPublicKeys, values } = recipientData;
  const recipientZkpPublicKeys = recipientCompressedZkpPublicKeys.map(key =>
    ZkpKeys.decompressZkpPublicKey(key),
  );
  if (recipientCompressedZkpPublicKeys.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = await shieldContractInstance.methods.getMaticAddress().call();

  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);

  const commitmentsInfo = await getCommitmentsValues({
    totalValue: totalValueToSend,
    valuesArray: values,
    recipientZkpPublicKeysArray: recipientZkpPublicKeys,
    ercAddress,
    tokenId,
    rootKey,
    isFee: false,
  });

  const commitmentsInfoFee = await getCommitmentsValues({
    totalValue: fee.bigInt,
    valuesArray: [],
    recipientZkpPublicKeysArray: [],
    ercAddress: generalise(maticAddress.toLowerCase()),
    tokenId: generalise(0),
    rootKey,
    isFee: true,
  });

  // KEM-DEM encryption
  const [ePrivate, ePublic] = await genEphemeralKeys();
  const [unpackedTokenID, packedErc] = packSecrets(tokenId, ercAddress, 0, 2);
  const compressedSecrets = encrypt(generalise(ePrivate), generalise(recipientZkpPublicKeys[0]), [
    packedErc.bigInt,
    unpackedTokenID.bigInt,
    values[0].bigInt,
    commitmentsInfo.salts[0].bigInt,
  ]);

  // Compress the public key as it will be put on-chain
  const compressedEPub = edwardsCompress(ePublic);

  // now we have everything we need to create a Witness and compute a proof
  const transaction = new Transaction({
    fee,
    historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
    historicRootBlockNumberL2Fee: commitmentsInfoFee.blockNumberL2s,
    transactionType: 1,
    ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
    tokenId: compressedSecrets[1], // this is the encrypted tokenID
    recipientAddress: compressedEPub,
    commitments: commitmentsInfo.newCommitments,
    commitmentFee: commitmentsInfoFee.newCommitments,
    nullifiers: commitmentsInfo.nullifiers,
    nullifiersFee: commitmentsInfoFee.nullifiers,
    compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
  });

  const privateData = {
    rootKey: [rootKey, rootKey],
    oldCommitmentPreimage: commitmentsInfo.oldCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    paths: commitmentsInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
    orders: commitmentsInfo.leafIndices,
    newCommitmentPreimage: commitmentsInfo.newCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    recipientPublicKeys: commitmentsInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
    rootKeyFee: [rootKey, rootKey],
    oldCommitmentPreimageFee: commitmentsInfoFee.oldCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    pathsFee: commitmentsInfoFee.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
    ordersFee: commitmentsInfoFee.leafIndices,
    newCommitmentPreimageFee: commitmentsInfoFee.newCommitments.map(o => {
      return { value: o.preimage.value, salt: o.preimage.salt };
    }),
    recipientPublicKeysFee: commitmentsInfoFee.newCommitments.map(o => o.preimage.zkpPublicKey),
    ercAddress,
    tokenId,
    ephemeralKey: ePrivate,
  };

  const witness = computeCircuitInputs(
    transaction,
    privateData,
    commitmentsInfo.roots,
    commitmentsInfoFee.roots,
    maticAddress,
  );
  logger.debug(`witness input is ${witness.join(' ')}`);
  // call a zokrates worker to generate the proof
  let folderpath = 'transfer';
  if (USE_STUBS) folderpath = 'transfer_stub';
  const res = await axios.post(`${PROTOCOL}${ZOKRATES_WORKER_HOST}/generate-proof`, {
    folderpath,
    inputs: witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });
  logger.trace(`Received response ${JSON.stringify(res.data, null, 2)}`);
  const { proof } = res.data;
  // and work out the ABI encoded data that the caller should sign and send to the shield contract

  const optimisticTransferTransaction = new Transaction({
    fee,
    historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
    historicRootBlockNumberL2Fee: commitmentsInfoFee.blockNumberL2s,
    transactionType: 1,
    ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
    tokenId: compressedSecrets[1], // this is the encrypted tokenID
    recipientAddress: compressedEPub,
    commitments: commitmentsInfo.newCommitments,
    nullifiers: commitmentsInfo.nullifiers,
    commitmentFee: commitmentsInfoFee.newCommitments,
    nullifiersFee: commitmentsInfoFee.nullifiers,
    compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
    proof,
  });

  logger.debug(
    `Client made transaction ${JSON.stringify(
      optimisticTransferTransaction,
      null,
      2,
    )} offchain ${offchain}`,
  );
  return updateCommitments(
    offchain,
    optimisticTransferTransaction,
    [...commitmentsInfo.newCommitments, ...commitmentsInfoFee.newCommitments],
    [...commitmentsInfo.oldCommitments, ...commitmentsInfoFee.oldCommitments],
    rootKey,
  );
}

export default transfer;
