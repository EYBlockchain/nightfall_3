import axios from 'axios';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const url = `http://${config.TIMBER_HOST}:${config.TIMBER_PORT}`;
const contractName = config.STATE_CONTRACT_NAME;

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
