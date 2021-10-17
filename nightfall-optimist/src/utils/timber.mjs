import axios from 'axios';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getLatestTree, getTreeByRoot, getTreeByLeafCount } from '../services/database.mjs';

const { ZERO, TIMBER_HEIGHT } = config;
const url = `http://${config.TIMBER_HOST}:${config.TIMBER_PORT}`;
const contractName = config.STATE_CONTRACT_NAME;

/**
 * This function just does some padding of the frontier, since we don't want to store trailing zeroes
 * @param timber - The timber instance whose frontier we will pad
 * @returns The same timber instance but with the frontier padded with '0x00..00'
 */
const prepTimberObj = timber => {
  const { frontier, ...rest } = timber;
  const paddedFrontier = frontier.concat(Array(TIMBER_HEIGHT - frontier.length + 1).fill(ZERO));
  return {
    frontier: paddedFrontier,
    ...rest,
  };
};

export const getRoot = async () => {
  const localTimber = await getLatestTree();
  return localTimber.root;
};

/**
returns the frontier etc at the point in time where the tree had the given root.
This is useful for checking that the root of an optimistic block is correct
@author Westlad
@param {string} root - the historic root of the merkle tree
*/
export const getTreeHistory = async root => {
  const localTimber = await getTreeByRoot(root);
  return prepTimberObj(localTimber);
};

/**
returns the frontier etc at the point in time where the tree had the given current leaf count.
This is useful for checking that the root of an optimistic block is correct
@author Westlad
@param {string} currentLeafCount - the current leaf count of the merkle tree when history associated with the block is created
*/
export const getTreeHistoryByCurrentLeafCount = async currentLeafCount => {
  return getTreeByLeafCount(currentLeafCount);
};

/**
returns the latest frontier.  This is useful for calculating the root of the
next block.
@author Westlad
*/
export const getFrontier = async () => {
  const localTimber = prepTimberObj(await getLatestTree());
  return localTimber.frontier;
};

/**
returns the count of leaves in the current tree. Useful to sync state between optimist.
 */
export const getLeafCount = async () => {
  const localTimber = await getLatestTree();
  return localTimber.leafCount;
};

export const callTimberHandler = async data => {
  try {
    logger.http(`Calling /replayEvent for Timber`);
    const response = await axios.post(
      `${url}/replayEvent`,
      {
        contractName,
        eventData: data,
      },
      {
        timeout: 3600000,
      },
    );
    logger.http('Timber Response:', response.data.data);
    return response.data.data;
  } catch (error) {
    throw new Error(error);
  }
};
