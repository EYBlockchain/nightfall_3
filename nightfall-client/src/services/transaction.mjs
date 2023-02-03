/* eslint-disable import/prefer-default-export */

import axios from 'axios';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import getProposers from '@polygon-nightfall/common-files/utils/proposer.mjs';
import NotFoundError from '@polygon-nightfall/common-files/utils/not-found-error.mjs';
import ValidationError from '@polygon-nightfall/common-files/utils/validation-error.mjs';

const STATUS_MINED = 'mined';
const STATUS_MEMPOOL = 'mempool';

export async function findTransactionInMempools(l2TransactionHash) {
  logger.debug('Get all registered proposer URLs from State contract..');
  const proposerURLs = (await getProposers()).map(p => p.url);

  logger.debug('Query each proposer mempool..');
  const promises = [];
  proposerURLs.forEach(pURL => {
    promises.push(axios.get(`${pURL}/proposer/mempool/${l2TransactionHash}`));
  });

  /*
    The user may have sent the transaction multiple times to different proposers,
    but this situation should be resolved when including the tx in L2 block
  */
  let res;
  try {
    res = await Promise.any(promises);
  } catch (err) {
    logger.trace(err);
    throw new NotFoundError(`Could not find L2 transaction hash ${l2TransactionHash}`);
  }

  return res.data; // ie transaction object
}

export function setL2TransactionStatus(transaction) {
  const { blockNumberL2 } = transaction;
  logger.debug(`Set status for L2 transaction with L2 block number ${blockNumberL2}..`);

  let status;
  if (blockNumberL2 >= 0) {
    status = STATUS_MINED;
  } else if (blockNumberL2 === -1) {
    status = STATUS_MEMPOOL;
  } else {
    throw new ValidationError(`Incorrect L2 block number ${blockNumberL2}`);
  }

  return status;
}
