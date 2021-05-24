import axios from 'axios';
import config from 'config';
import logger from './logger.mjs';

const url = `http://${config.OPTIMIST_HOST}:${config.OPTIMIST_PORT}`;

/**
returns the block hash of the block that holds the root
@author ChaitanyaKonda
@param {string} root - the historic root of the merkle tree
*/

export const getHistoricRootBlockHash = async root => {
  logger.http(`Calling /block/blockHash/:root for root ${root.hex(32)} and url ${url}`);
  try {
    const response = await axios.get(
      `${url}/block/root`,
      {
        params: {
          root: root.hex(32),
        },
      },
      {
        timeout: 3600000,
      },
    );
    const {
      data: { blockHash },
    } = response;
    logger.http('Optimist Response:', response.data);
    logger.debug(`The block hash for the root ${root} is ${blockHash}`);
    if (!blockHash) return null;
    return blockHash;
  } catch (error) {
    logger.error(`getHistoricRootBlockHash threw error ${error.response.data}`);
    throw new Error(error.response.data);
  }
};

export default {
  getHistoricRootBlockHash,
};
