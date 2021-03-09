/**
Module to set up all of the circuits contained in circuits/ to a zokrates
instance. Note, we don't need to deploy the circuits through a zokrates microservice http interface because we're going to create the volume that the zokrates microservice mounts to hold its circuits, so we'll just pop them straight in there. No one will mind.
*/
import axios from 'axios';
import config from 'config';
import fs from 'fs';
import path from 'path';
import logger from './utils/logger.mjs';
import Web3 from './utils/web3.mjs';
import { getContractAddress, getContractInstance } from './utils/contract.mjs';

const fsPromises = fs.promises;

/**
This function will ping the Zokrates service until it is up before attempting
to use it. This is because the deployer must start before Zokrates as it needs
to populate Zokrates' volumes.  Thus it can't be sure that Zokrates is up yet
*/
async function waitForZokrates() {
  logger.info('checking for zokrates_worker');
  try {
    while (
      (await axios.get(`${config.PROTOCOL}${config.ZOKRATES_WORKER_HOST}/healthcheck`)).status !==
      200
    ) {
      logger.warn(
        `No response from zokratesworker yet.  That's ok. We'll wait three seconds and try again...`,
      );
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
  logger.info('zokrates_worker reports that it is healthy');
}

// function to extract all file paths in a directory

async function walk(dir) {
  let files = await fsPromises.readdir(dir);
  files = files.filter(file => !file.includes(config.EXCLUDE_DIRS)); // remove common dir
  files = await Promise.all(
    files.map(async file => {
      const filePath = path.join(dir, file);
      const stats = await fsPromises.stat(filePath);
      if (stats.isDirectory()) return walk(filePath);
      if (stats.isFile()) return filePath;
      return undefined;
    }),
  );
  return files
    .reduce((all, folderContents) => all.concat(folderContents), [])
    .map(file => file.replace(config.CIRCUITS_HOME, ''))
    .filter(file => file.endsWith('.zok'));
}
/**
This calls the /generateKeys endpoint on a zokrates microservice container to do the setup.
*/
async function setupCircuits() {
  // do all the trusted setups needed
  const circuitsToSetup = await walk(config.CIRCUITS_HOME);
  for (const circuit of circuitsToSetup) {
    // first check if a vk already exists
    let vk;
    logger.debug(`checking for existing setup for ${circuit}`);
    const folderpath = circuit.slice(0, -4); // remove the .zok extension
    const res1 = await axios.get(`${config.PROTOCOL}${config.ZOKRATES_WORKER_HOST}/vk`, {
      params: { folderpath },
    });
    vk = res1.data.vk;
    if (!vk || config.ALWAYS_DO_TRUSTED_SETUP) {
      // we don't have an existing vk so let's generate one
      try {
        logger.info(
          `no existing verification key. Fear not, I will make a new one: calling generate keys on ${circuit}`,
        );
        const res2 = await axios.post(
          `${config.PROTOCOL}${config.ZOKRATES_WORKER_HOST}/generate-keys`,
          {
            filepath: circuit,
            curve: config.CURVE,
            provingScheme: config.PROVING_SCHEME,
            backend: config.BACKEND,
          },
        );
        vk = res2.data.vk;
      } catch (err) {
        logger.error(err);
      }
    } else logger.info(`${circuit} verification key exists: trusted setup skipped`);
    // we should register the vk now
    logger.info(`Registering verification key for ${circuit}`);
    try {
      delete vk.raw; // long and not needed
      logger.silly('vk:', vk);
      const vkArray = Object.values(vk).flat(Infinity); // flatten the Vk array of arrays because that's how Shield.sol likes it.  I see no need for decimal conversion here - but that may be wrong.
      const shieldAddress = await getContractAddress('Shield');
      const shield = await getContractInstance('Shield', shieldAddress);
      await shield.methods.registerVerificationKey(vkArray, config.VK_IDS[folderpath]).send();
    } catch (err) {
      logger.error(err);
      throw new Error(err);
    }
  }
  // before we finish, start Timber listening
  // startEventFilter();
  Web3.disconnect();
}

export default { setupCircuits, waitForZokrates };
