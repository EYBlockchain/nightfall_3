import axios from 'axios';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const url = `http://${config.TIMBER_HOST}:${config.TIMBER_PORT}`;
const contractName = config.STATE_CONTRACT_NAME;

export const startEventFilter = async () => {
  try {
    logger.silly(`Calling /start for Timber, with contractName '${contractName}' and url ${url}`);
    const response = await axios.post(
      `${url}/start`,
      {
        contractName,
      },
      {
        timeout: 3600000,
      },
    );
    logger.silly('Timber Response:', response.data.data);
    return response.data.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const getLeafIndex = async leafValue => {
  logger.silly(
    `Calling /leaf/value for leafValue ${leafValue}, contractName, ${contractName}, url ${url}`,
  );
  try {
    const value = leafValue.toString();
    const response = await axios.get(
      `${url}/leaf/value`,
      {
        params: {
          contractName,
          value,
        },
      },
      {
        timeout: 3600000,
      },
    );
    logger.silly('Timber Response:', response.data.data);
    if (!response.data.data) return null;
    return response.data.data.leafIndex;
  } catch (error) {
    logger.error(`getLeafIndex threw error ${error}`);
    throw new Error(error);
  }
};

export const getRoot = async () => {
  logger.silly(`Calling /update for Timber`);
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
    logger.silly('Timber Response:', response.data.data.latestRecalculation);
    // TODO: handle null response
    return response.data.data.latestRecalculation.root;
  } catch (error) {
    throw new Error(error);
  }
};

export const getSiblingPath = async leafIndex => {
  logger.silly(`Calling /siblingPath/${leafIndex}`);
  try {
    const response = await axios.get(
      `${url}/siblingPath/${leafIndex}`, //
      {
        params: {
          contractName,
        },
      },
      {
        timeout: 360000,
      },
    );
    logger.silly('Timber Response:', response.data.data);
    // TODO: handle null response
    const siblingPath = response.data.data;
    const siblingPathValues = siblingPath.map(node => node.value);
    return siblingPathValues;
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
  logger.silly(`Calling /tree-history/${root}`);
  const response = await axios.get(
    `${url}/tree-history/${root}`,
    { params: { contractName } },
    { timeout: 360000 },
  );
  return response.data.data;
};

export default {
  getLeafIndex,
  getRoot,
  getSiblingPath,
};
