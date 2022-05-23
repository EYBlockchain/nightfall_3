/* ignore unused exports */

/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */

import gen from 'general-number';

import rand from '../../common-files/utils/crypto/crypto-random';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Secrets, Nullifier, Commitment, Transaction } from '../classes/index';
import {
  findUsableCommitmentsMutex,
  storeCommitment,
  markNullified,
  clearPending,
  getSiblingInfo,
} from './commitment-storage';
import { decompressKey, calculateIvkPkdfromAskNsk } from './keys';
import { checkIndexDBForCircuit, getStoreCircuit } from './database';
import generateProof from './generateProof';

const { BN128_GROUP_ORDER, ZKP_KEY_LENGTH, SHIELD_CONTRACT_NAME, ZERO, USE_STUBS } = global.config;
const { generalise, GN } = gen;

const singleTransfer = USE_STUBS ? 'single_transfer_stub' : 'single_transfer';
const doubleTransfer = USE_STUBS ? 'double_transfer_stub' : 'double_transfer';

async function transfer(transferParams, shieldContractAddress) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { ercAddress, tokenId, recipientData, nsk, ask, fee } = generalise(transferParams);
  const { pkd, compressedPkd } = calculateIvkPkdfromAskNsk(ask, nsk);
  const { recipientCompressedPkds, values } = recipientData;
  const recipientPkds = recipientCompressedPkds.map(key => decompressKey(key));
  if (recipientCompressedPkds.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  // the first thing we need to do is to find some input commitments which
  // will enable us to conduct our transfer.  Let's rummage in the db...
  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  const oldCommitments = await findUsableCommitmentsMutex(
    compressedPkd,
    ercAddress,
    tokenId,
    totalValueToSend,
  );
  if (oldCommitments) logger.debug(`Found commitments ${JSON.stringify(oldCommitments, null, 2)}`);
  else throw new Error('No suitable commitments were found'); // caller to handle - need to get the user to make some commitments or wait until they've been posted to the blockchain and Timber knows about them
  try {
    // Having found either 1 or 2 commitments, which are suitable inputs to the
    // proof, the next step is to compute their nullifiers;
    const nullifiers = oldCommitments.map(commitment => new Nullifier(commitment, nsk));
    // then the new output commitment(s)
    const totalInputCommitmentValue = oldCommitments.reduce(
      (acc, commitment) => acc + commitment.preimage.value.bigInt,
      0n,
    );
    // we may need to return change to the recipient
    const change = totalInputCommitmentValue - totalValueToSend;
    // if so, add an output commitment to do that
    if (change !== 0n) {
      values.push(new GN(change));
      recipientPkds.push(pkd);
      recipientCompressedPkds.push(compressedPkd);
    }
    const newCommitments = [];
    let secrets = [];
    const salts = [];
    let potentialSalt;
    let potentialCommitment;
    for (let i = 0; i < recipientCompressedPkds.length; i++) {
      // loop to find a new salt until the commitment hash is smaller than the BN128_GROUP_ORDER
      do {
        // eslint-disable-next-line no-await-in-loop
        potentialSalt = new GN((await rand(ZKP_KEY_LENGTH)).bigInt % BN128_GROUP_ORDER);
        potentialCommitment = new Commitment({
          ercAddress,
          tokenId,
          value: values[i],
          pkd: recipientPkds[i],
          compressedPkd: recipientCompressedPkds[i],
          salt: potentialSalt,
        });
        // encrypt secrets such as erc20Address, tokenId, value, salt for recipient
        if (i === 0) {
          // eslint-disable-next-line no-await-in-loop
          secrets = await Secrets.encryptSecrets(
            [ercAddress.bigInt, tokenId.bigInt, values[i].bigInt, potentialSalt.bigInt],
            [recipientPkds[0][0].bigInt, recipientPkds[0][1].bigInt],
          );
        }
      } while (potentialCommitment.hash.bigInt > BN128_GROUP_ORDER);
      salts.push(potentialSalt);
      newCommitments.push(potentialCommitment);
    }

    // compress the secrets to save gas
    const compressedSecrets = Secrets.compressSecrets(secrets);

    const commitmentTreeInfo = await Promise.all(oldCommitments.map(c => getSiblingInfo(c)));
    const localSiblingPaths = commitmentTreeInfo.map(l => {
      const path = l.siblingPath.path.map(p => p.value);
      return generalise([l.root].concat(path.reverse()));
    });
    const leafIndices = commitmentTreeInfo.map(l => l.leafIndex);
    const blockNumberL2s = commitmentTreeInfo.map(l => l.isOnChain);
    // time for a quick sanity check.  We expect the number of old commitments,
    // new commitments and nullifiers to be equal.
    if (
      nullifiers.length !== oldCommitments.length ||
      nullifiers.length !== newCommitments.length
    ) {
      logger.error(
        `number of old commitments: ${oldCommitments.length}, number of new commitments: ${newCommitments.length}, number of nullifiers: ${nullifiers.length}`,
      );
      throw new Error(
        'Commitment or nullifier numbers are mismatched.  There should be equal numbers of each',
      );
    }

    // now we have everything we need to create a Witness and compute a proof
    const witnessInput = [
      oldCommitments.map(commitment => commitment.preimage.ercAddress.integer).flat(),
      oldCommitments.map(commitment => {
        return {
          id: commitment.preimage.tokenId.limbs(32, 8),
          value: commitment.preimage.value.limbs(32, 8),
          salt: commitment.preimage.salt.limbs(32, 8),
          hash: commitment.hash.limbs(32, 8),
          ask: ask.field(BN128_GROUP_ORDER),
        };
      }),
      newCommitments.map(commitment => {
        return {
          pkdRecipient: [
            commitment.preimage.pkd[0].field(BN128_GROUP_ORDER),
            commitment.preimage.pkd[1].field(BN128_GROUP_ORDER),
          ],
          value: commitment.preimage.value.limbs(32, 8),
          salt: commitment.preimage.salt.limbs(32, 8),
        };
      }),
      newCommitments.map(commitment => commitment.hash.integer),
      nullifiers.map(nullifier => nullifier.preimage.nsk.limbs(32, 8)),
      nullifiers.map(nullifier => generalise(nullifier.hash.hex(32, 31)).integer),
      localSiblingPaths.map(siblingPath => siblingPath[0].field(BN128_GROUP_ORDER, false)),
      localSiblingPaths.map(siblingPath =>
        siblingPath.slice(1).map(node => node.field(BN128_GROUP_ORDER, false)),
      ), // siblingPAth[32] is a sha hash and will overflow a field but it's ok to take the mod here - hence the 'false' flag
      leafIndices.map(leaf => leaf.toString()),
      {
        ephemeralKey1: secrets.ephemeralKeys[0].limbs(32, 8),
        ephemeralKey2: secrets.ephemeralKeys[1].limbs(32, 8),
        ephemeralKey3: secrets.ephemeralKeys[2].limbs(32, 8),
        ephemeralKey4: secrets.ephemeralKeys[3].limbs(32, 8),
        cipherText: secrets.cipherText.flat().map(text => text.field(BN128_GROUP_ORDER)),
        sqrtMessage1: secrets.squareRootsElligator2[0].field(BN128_GROUP_ORDER),
        sqrtMessage2: secrets.squareRootsElligator2[1].field(BN128_GROUP_ORDER),
        sqrtMessage3: secrets.squareRootsElligator2[2].field(BN128_GROUP_ORDER),
        sqrtMessage4: secrets.squareRootsElligator2[3].field(BN128_GROUP_ORDER),
      },
      compressedSecrets.map(text => {
        const bin = text.binary.padStart(256, '0');
        const parity = bin[0];
        const ordinate = bin.slice(1);
        const fields = {
          parity: !!Number(parity), // This converts parity into true / false from 1 / 0;
          ordinate: new GN(ordinate, 'binary').field(BN128_GROUP_ORDER),
        };
        return fields;
      }),
    ];

    const flattenInput = witnessInput.map(w => {
      if (w.length === 1) {
        const [w_] = w;
        return w_;
      }
      return w;
    });

    console.log(`witness input is ${JSON.stringify(flattenInput)}`);
    // call a zokrates worker to generate the proof
    // This is (so far) the only place where we need to get specific about the
    // circuit
    let abi;
    let program;
    let pk;
    let transactionType;
    if (oldCommitments.length === 1) {
      transactionType = 1;
      blockNumberL2s.push(0); // We need top pad block numbers if we do a single transfer
      if (!(await checkIndexDBForCircuit(singleTransfer)))
        throw Error('Some circuit data are missing from IndexedDB');
      const [abiData, programData, pkData] = await Promise.all([
        getStoreCircuit(`${singleTransfer}-abi`),
        getStoreCircuit(`${singleTransfer}-program`),
        getStoreCircuit(`${singleTransfer}-pk`),
      ]);
      abi = abiData.data;
      program = programData.data;
      pk = pkData.data;
    } else if (oldCommitments.length === 2) {
      transactionType = 2;
      if (!(await checkIndexDBForCircuit(doubleTransfer)))
        throw Error('Some circuit data are missing from IndexedDB');
      const [abiData, programData, pkData] = await Promise.all([
        getStoreCircuit(`${doubleTransfer}-abi`),
        getStoreCircuit(`${doubleTransfer}-program`),
        getStoreCircuit(`${doubleTransfer}-pk`),
      ]);
      abi = abiData.data;
      program = programData.data;
      pk = pkData.data;
    } else throw new Error('Unsupported number of commitments');

    const artifacts = { program: new Uint8Array(program), abi };
    const provingKey = new Uint8Array(pk);

    let proof = await generateProof(artifacts, flattenInput, provingKey);
    proof = [...proof.a, ...proof.b, ...proof.c];
    proof = proof.flat(Infinity);
    // and work out the ABI encoded data that the caller should sign and send to the shield contract
    const shieldContractInstance = await getContractInstance(
      SHIELD_CONTRACT_NAME,
      shieldContractAddress,
    );
    const optimisticTransferTransaction = new Transaction({
      fee,
      historicRootBlockNumberL2: blockNumberL2s,
      transactionType,
      ercAddress: ZERO,
      commitments: newCommitments,
      nullifiers,
      compressedSecrets,
      proof,
    });
    // if (offchain) {
    //   await axios
    //     .post(
    //       `${proposerUrl}/proposer/offchain-transaction`,
    //       { transaction: optimisticTransferTransaction },
    //       { timeout: 3600000 },
    //     )
    //     .catch(err => {
    //       throw new Error(err);
    //     });
    //   // we only want to store our own commitments so filter those that don't
    //   // have our public key
    //   newCommitments
    //     .filter(commitment => commitment.preimage.compressedPkd.hex(32) === compressedPkd.hex(32))
    //     .forEach(commitment => storeCommitment(commitment, nsk)); // TODO insertMany
    //   // mark the old commitments as nullified
    //   await Promise.all(
    //     oldCommitments.map(commitment => markNullified(commitment, optimisticTransferTransaction)),
    //   );
    //   await saveTransaction(optimisticTransferTransaction);
    //   return {
    //     transaction: optimisticTransferTransaction,
    //     salts: salts.map(salt => salt.hex(32)),
    //   };
    // }
    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(optimisticTransferTransaction))
      .encodeABI();
    // store the commitment on successful computation of the transaction
    newCommitments
      .filter(commitment => commitment.preimage.compressedPkd.hex(32) === compressedPkd.hex(32))
      .forEach(commitment => storeCommitment(commitment, nsk)); // TODO insertMany
    // mark the old commitments as nullified
    await Promise.all(
      oldCommitments.map(commitment => markNullified(commitment, optimisticTransferTransaction)),
    );
    // await saveTransaction(optimisticTransferTransaction);
    return {
      rawTransaction,
      transaction: optimisticTransferTransaction,
      salts: salts.map(salt => salt.hex(32)),
    };
  } catch (err) {
    await Promise.all(oldCommitments.map(commitment => clearPending(commitment)));
    throw new Error(err); // let the caller handle the error
  }
}

export default transfer;
