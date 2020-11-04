import axios from 'axios';
import logger from './logger';
/**
function to automatically start the Timber instance.  This is useful if you are
starting it up in an already-established blockchain environment.
Currently it only supports a single shield contract.
*/
const autoStart = async contractName => {
  try {
    logger.debug(
      `Calling /start for Timber, with contractName '${contractName}' and url localhost`,
    );
    const response = await axios.post(
      'http://localhost/start',
      {
        contractName,
      },
      {
        timeout: 3600000,
      },
    );
    logger.debug('Timber Response:', response.data.data);
    return response.data.data;
  } catch (error) {
    throw new Error(error);
  }
};

export default autoStart;
