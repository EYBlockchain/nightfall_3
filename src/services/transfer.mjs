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
import sha256 from '../utils/crypto/sha256.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import { getContractInstance } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';
import { findUsableCommittments } from './commitment-storage.mjs';

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
  const commitments = await findUsableCommittments(senderZkpPublicKey, ercAddress, tokenId, value);
  if (commitments) logger.info(`found commitments ${JSON.stringify(commitments, null,2)}`);
}

export default transfer;
