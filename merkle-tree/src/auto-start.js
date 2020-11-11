import axios from 'axios';
import config from 'config';
import logger from './logger';
import uw from './utils-web3';
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
    // if we haven't been given a contractAddress, it's best to make sure that
    // Timber has the ability to infer one. Otherwise Timber will fall over. If
    // the build artefacts don't exist yet then we need to wait.
    // Stop eslint complaining because we DO want delays in this loop
    let retries = process.env.AUTOSTART_RETRIES || 20;
    while (!data.contractAddress) {
      try {
        // eslint-disable-next-line no-await-in-loop
        data.contractAddress = await uw.getContractAddress(contractName);
        // we want to catch if the above function throws OR returns undefined
        if (data.contractAddress === undefined) throw new Error('undefined contract address');
        logger.info(`Contract address for contract ${contractName} is ${data.contractAddress}`);
      } catch (err) {
        if (retries === 0) throw new Error(err);
        retries--;
        logger.warn('Unable to find a contract address. Retrying in 3 seconds.');
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    // Now that we are fairly sure calling start will work, we can go ahead.
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
