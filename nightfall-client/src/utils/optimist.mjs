/**
Functions for querying the nightfall-optimist container
*/

import axios from 'axios';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const url = `http://${config.OPTIMIST_HOST}:${config.OPTIMIST_PORT}`;

export async function getBlockAndTransactionsByRoot(root) {
  logger.http(`Calling block/root/${root}`);
  const response = await axios.get(`${url}/block/root/${root}`);
  return response.data;
}

export async function getBlockByTransactionHash(withdrawTransactionHash) {
  logger.http(`Calling block/transaction-hash/${withdrawTransactionHash}`);
  const response = await axios.get(`${url}/block/transaction-hash/${withdrawTransactionHash}`);
  return response.data;
}

export default getBlockAndTransactionsByRoot;
