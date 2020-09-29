/**
Module to set up all of the circuits contained in circuits/ to a zokrates
instance. Note, we don't need to deploy the circuits through a zokrates microservice http interface because we're going to create the volume that the zokrates microservice mounts to hold its circuits, so we'll just pop them straight in there. No one will mind.
*/
import axios from 'axios';
import config from 'config';
import logger from './utils/logger.mjs';
// import Web3 from './utils/web3.mjs';
// import { generalise } from './utils/general-number.mjs';

// const web3 = Web3.connection();

/**
This function will ping the Zokrates service until it is up before attempting
to use it. This is because the deployer must start before Zokrates as it needs
to populate Zokrates' volumes.  Thus it can't be sure that Zokrates is up yet
*/
async function waitForZokrates() {
  logger.info('checking for zokrates_worker');
  while (
    (await axios.get(`${config.PROTOCOL}${config.ZOKRATES_WORKER_HOST}/healthcheck`)).status !== 200
  ) {
    logger.warn(
      `No response from zokratesworker yet.  That's ok. We'll wait three seconds and try again...`,
    );
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  logger.info('zokrates_worker reports that it is healthy');
}

/**
This calls the /generateKeys endpoint on a zokrates microservice container to do the setup.
*/
async function setupCircuits() {
  // do all the trusted setups needed
  for (const path of config.TRUSTED_SETUPS_TODO) {
    // first check if a vk already exists
    let vk;
    logger.debug(`checking for existing setup for ${path}`);
    const folderpath = path.slice(0, -4); // remove the .zok extension
    const res1 = await axios.get(`${config.PROTOCOL}${config.ZOKRATES_WORKER_HOST}/vk`, {
      params: { folderpath },
    });
    vk = res1.data.vk;
    if (!vk || config.ALWAYS_DO_TRUSTED_SETUP) {
      // we don't have an existing vk so let's generate one
      try {
        logger.debug(`no existing verification key: calling generate keys on ${path}`);
        const res2 = await axios.post(
          `${config.PROTOCOL}${config.ZOKRATES_WORKER_HOST}/generate-keys`,
          {
            filepath: path,
            curve: 'bn128',
            provingScheme: 'gm17',
            backend: 'libsnark',
          },
        );
        vk = res2.data.vk;
      } catch (err) {
        logger.error(err);
      }
    } else logger.info(`${path} verification key exists: trusted setup skipped`);
    // we should register the vk now
    logger.warn('VK REGISTERING NOT YET IMPLEMENTED');
  }
  // and, lastly, we register the outer vk with ZVM.sol
  /*
  try {
    logger.debug('Registering outer verification vk');
    delete vk.raw; // long and not needed
    logger.silly('outer vk:', vk);
    const vkArray = Object.values(vk).flat(Infinity); // flatten the Vk array of arrays because that's how ZVM.sol likes it.  I see no need for decimal conversion here - but that may be wrong.
    logger.silly(`flattened outer vk: ${vkArray}`);
    const generalisedVk = generalise(vkArray.flat(Infinity));
    const limbedVk = generalisedVk.map(coeff => coeff.limbs(256, 3)).flat(Infinity); // convert to three limbs of size 256-bits (VK is a bw6 one of 761-bits).

    const accounts = await web3.eth.getAccounts();
    logger.debug('blockchain accounts are: ', accounts);

    // FUTURE ENHANCEMENTS: generalise this code to submit outerVKs for all permutations of input/output commitments
    await registerOuterVK(2, 2, limbedVk, accounts[0]);
    logger.info('Registered outer verification vk with ZVM');
    // check we have actually stored the verification vk
    const zvmVK = await getOuterVK(2, 2);
    for (let i = 0; i < vk.length; i++) {
      if (zvmVK[i] !== vk[i])
        throw new Error(`retrievedVk element was ${zvmVK[i]} but vk element was ${vk[i]} at ${i}`);
    }
    logger.info('Storage of outer verification vk confirmed');
  } catch (err) {
    logger.error(err);
    throw new Error(err);
  }
  */
  // Web3.disconnect();
}

export default { setupCircuits, waitForZokrates };
