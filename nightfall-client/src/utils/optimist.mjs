/**
Functions for querying the nightfall-optimist container
*/

import axios from 'axios';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const url = `http://${config.OPTIMIST_HOST}:${config.OPTIMIST_PORT}`;

// eslint-disable-next-line import/prefer-default-export
export async function getBlockByTransactionHash(withdrawTransactionHash) {
  logger.http(`Calling block/transaction-hash/${withdrawTransactionHash}`);
  const response = await axios.get(`${url}/block/transaction-hash/${withdrawTransactionHash}`);
  return response.data;
}
