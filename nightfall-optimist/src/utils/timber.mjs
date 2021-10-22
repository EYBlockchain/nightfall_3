import axios from 'axios';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const url = `http://${config.TIMBER_HOST}:${config.TIMBER_PORT}`;
const contractName = config.STATE_CONTRACT_NAME;

// eslint-disable-next-line import/prefer-default-export
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
