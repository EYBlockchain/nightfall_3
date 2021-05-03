import axios from 'axios';
import config from 'config';
import { getContractAddress } from './contract.mjs';
import logger from './logger.mjs';

const url = `http://${config.TIMBER_HOST}:${config.TIMBER_PORT}`;
const contractName = config.SHIELD_CONTRACT_NAME;
const contractAddress = getContractAddress(contractName);

export const startEventFilter = async () => {
  try {
    logger.http(
      `Calling /start for Timber, with contractName '${contractName}' and address '${await contractAddress}' and url ${url}`,
    );
    const response = await axios.post(
      `${url}/start`,
      {
        contractName,
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

export const getLeafIndex = async leafValue => {
  logger.http(`Calling /leaf/value for leafValue ${leafValue}`);
  try {
    const value = leafValue.toString();
    const response = await axios.get(
      `${url}/leaf/value`,
      {
        data: {
          contractName,
          contractAddress: await contractAddress,
          value,
        },
      },
      {
        timeout: 3600000,
      },
    );
    logger.http('Timber Response:', response.data.data);
    // TODO: handle null response
    return response.data.data.leafIndex;
  } catch (error) {
    throw new Error(error);
  }
};

export const getRoot = async () => {
  logger.http(`Calling /update for Timber`);
  try {
    const response = await axios.patch(
      `${url}/update`,
      {
        contractName: contractName,
        contractAddress: await contractAddress,
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

export const getSiblingPath = async (treeId, leafIndex, leafValue) => {
  logger.http(`Calling /siblingPath/${leafIndex} for ${treeId} tree`);
  try {
    if (leafIndex === undefined) {
      if (!leafValue) throw new Error(`No leafIndex xor leafValue specified.`);
      // eslint-disable-next-line no-param-reassign
      leafIndex = await getLeafIndex(treeId, leafValue);
    }
    const response = await axios.get(
      `${url}/siblingPath/${leafIndex}`, //
      {
        data: {
          contractName,
          contractAddress: await contractAddress,
        },
      },
      {
        timeout: 360000,
      },
    );
    logger.http('Timber Response:', response.data.data);
    // TODO: handle null response
    const siblingPath = response.data.data;
    const siblingPathValues = siblingPath.map(node => node.value);
    return siblingPathValues;
  } catch (error) {
    throw new Error(error);
  }
};

export default {
  getLeafIndex,
  getRoot,
  getSiblingPath,
};
