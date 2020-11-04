import axios from 'axios';
import config from 'config';
import logger from './logger';
/**
function to automatically start the Timber instance.  This is useful if you are
starting it up in an already-established blockchain environment.
Currently it only supports a single shield contract.
*/
const autoStart = async () => {
  const contractNames = Object.keys(config.contracts);
  for (const contractName of contractNames) {
    const data = {
      contractName,
      contractAddress: config.contracts[contractName].address,
      treeId: config.contracts[contractName].treeId,
    };
    try {
      logger.debug(
        `Calling /start for Timber, with contractName '${contractName}' and url localhost`,
      );
      axios.post('http://localhost/start', data, {
        timeout: 3600000,
      });
    } catch (error) {
      throw new Error(error);
    }
  }
};

export default autoStart;
