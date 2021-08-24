import axios from 'axios';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const url = `http://${config.TIMBER_HOST}:${config.TIMBER_PORT}`;
const contractName = config.STATE_CONTRACT_NAME;

export const getRoot = async () => {
  logger.http(`Calling /update for Timber`);
  try {
    const response = await axios.patch(
      `${url}/update`,
      {
        contractName,
      },
      {
        timeout: 3600000,
      },
    );
    logger.http('Timber Response:', response.data.data.latestRecalculation);
    // TODO: handle null response
    return response.data.data.latestRecalculation.root;
  } catch (error) {
    throw new Error(error);
  }
};

/**
returns the frontier etc at the point in time where the tree had the given root.
This is useful for checking that the root of an optimistic block is correct
@author Westlad
@param {string} root - the historic root of the merkle tree
*/
export const getTreeHistory = async root => {
  logger.http(`Calling /tree-history/root/${root}`);
  const response = await axios.get(
    `${url}/tree-history/root/${root}`,
    { params: { contractName } },
    { timeout: 360000 },
  );
  return response.data.data;
};

/**
returns the frontier etc at the point in time where the tree had the given current leaf count.
This is useful for checking that the root of an optimistic block is correct
@author Westlad
@param {string} currentLeafCount - the current leaf count of the merkle tree when history associated with the block is created
*/
export const getTreeHistoryByCurrentLeafCount = async currentLeafCount => {
  logger.http(`Calling /tree-history/currentLeafCount/${currentLeafCount}`);
  const response = await axios.get(
    `${url}/tree-history/currentLeafCount/${currentLeafCount}`,
    { params: { contractName } },
    { timeout: 360000 },
  );
  return response.data.data;
};

/**
returns the latest frontier.  This is useful for calculating the root of the
next block.
@author Westlad
*/
export const getFrontier = async () => {
  logger.http(`Calling /update for Timber`);
  try {
    const response = await axios.patch(`${url}/update`, { contractName }, { timeout: 3600000 });
    logger.silly('Timber response:', response.data.data.latestRecalculation);
    // TODO: handle null response
    return response.data.data.latestRecalculation.frontier.map(e => e ?? config.ZERO);
  } catch (error) {
    throw new Error(error);
  }
};

/**
returns the count of leaves in the current tree. Useful to sync state between optimist.
 */
export const getLeafCount = async () => {
  logger.http(`Calling /leaves/count`);
  try {
    const response = await axios.get(
      `${url}/leaves/count`,
      {
        params: {
          contractName,
        },
      },
      {
        timeout: 3600000,
      },
    );
    logger.http(`Timber Response: ${response.data.data.leafCount}`);
    if (!response.data.data) return null;
    return response.data.data.leafCount;
  } catch (error) {
    throw new Error(error);
  }
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
