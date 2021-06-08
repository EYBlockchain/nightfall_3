/**
Functions for querying the nightfall-optimist container
*/

import axios from 'axios';
import config from 'config';
// import { getContractAddress } from './contract.mjs';
import logger from './logger.mjs';

const url = `http://${config.OPTIMIST_HOST}:${config.OPTIMIST_PORT}`;

async function getBlockAndTransactionsByRoot(root) {
  logger.http(`Calling block/root/${root}`);
  const response = await axios.get(`${url}/block/root/${root}`);
  return response.data;
}

export default getBlockAndTransactionsByRoot;
