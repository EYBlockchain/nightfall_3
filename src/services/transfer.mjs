/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import axios from 'axios';
import gen from 'general-number';
import { sha256 } from '../utils/crypto/sha256.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';
import mongo from '../utils/mongo.mjs';

const {
  ZKP_KEY_LENGTH,
  ZOKRATES_WORKER_URL,
  SHIELD_CONTRACT_NAME,
  COMMITMENTS_COLLECTION,
  MONGO_URL,
  COMMITMENTS_DB,
} = config;
const { generalise, GN } = gen;

async function transfer(items) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { ercAddress, tokenId, value, senderZkpPublicKey, recipientZkpPublicKey } = generalise(
    items,
  );
  // the first thing we need to do is to find some input commitments which
  // will enable us to conduct our transfer.  Let's rummage in the db...
  const connection = await mongo.connect(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      zkpPublicKey: senderZkpPublicKey.hex(32),
      ercAddress: ercAddress.hex(32),
      tokenId: tokenId.hex(32),
    })
    .toArray();
  if (commitments === []) throw new Error('No commitments found');
  // now we need to treat different cases
  // if we have an exact match, we can do a single-commitment transfer.
  // this function will tell us:
  const singleCommitment = (() => {
    for (const commitment of commitments) {
      if (commitment.value === value.decimal) {
        logger.info('Found commitment suitable for single transfer');
        return commitment;
      }
    }
    return undefined;
  })();
  if (singleCommitment) {
    // DO a single commitment transfer
    logger.info('Doing single-token transfer');
    logger.silly(`with commitment ${JSON.stringify(singleCommitment, null, 2)}`);
    const rawTransaction = 'Not implemented';
    return rawTransaction;
  }
  // if not, maybe we can do a two-commitment transfer, this is a expensive search and this function will tell us:
  const twoCommitment = (() => {
    for (const commitmentC of commitments) {
      const innerResult = (() => {
        for (const commitmentD of commitments) {
          if (BigInt(commitmentC.value) + BigInt(commitmentD.value) > value.bigInt) {
            logger.info('Found commitments suitable for two-token transfer');
            return { commitmentC, commitmentD };
          }
        }
        return undefined;
      })();
      if (innerResult) return innerResult;
    }
    return undefined;
  })();
  if (twoCommitment) {
    // DO a two token transfer
    logger.info('Doing two-token transfer');
    logger.silly(`with commitments ${JSON.stringify(twoCommitment, null, 2)}`);
    const rawTransaction = 'Not implemented';
    return rawTransaction;
  }
  // if we arrive here then no suitable tokens are available. The user needs
  // to make some.  Handle this error and return a suitable message
  throw new Error('No suitable tokens found for transfer - need to create some');
}

export default transfer;
