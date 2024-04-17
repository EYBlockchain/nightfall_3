/* eslint-disable no-await-in-loop */

/**
Module to set up all of the circuits contained in circuits/ to a worker
instance. Note, we don't need to deploy the circuits through a worker microservice http interface because we're going to create the volume that the worker microservice mounts to hold its circuits, so we'll just pop them straight in there. No one will mind.
*/
import axios from 'axios';
import config from 'config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from 'common-files/utils/logger.mjs';
import Web3 from 'common-files/utils/web3.mjs';
import utils from 'common-files/utils/crypto/merkle-tree/utils.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';

const fsPromises = fs.promises;

/**
 * This function will ping the Worker service until it is up before attempting
 * to use it. This is because the deployer must start before Worker as it needs
 * to populate Worker' volumes.  Thus it can't be sure that Worker is up yet
 */
async function waitForWorker() {
  logger.info('checking for worker');
  try {
    while (
      (await axios.get(`${config.PROTOCOL}${config.CIRCOM_WORKER_HOST}/healthcheck`)).status !== 200
    ) {
      logger.warn(
        `No response from worker yet.  That's ok. We'll wait three seconds and try again...`,
      );

      // eslint-disable-next-line no-undef
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
  logger.info('worker reports that it is healthy');
}

/**
 * function to extract all file paths in a directory
 */
async function walk(dir) {
  let files = await fsPromises.readdir(dir);
  files = files.filter(file => !file.includes(config.EXCLUDE_DIRS)); // remove common dir
  // eslint-disable-next-line no-undef
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
    .filter(file => file.endsWith('.circom'));
}

/**
 * This calls the /generateKeys endpoint on a worker microservice container to do the setup.
 */
async function setupCircuits() {
  // do all the trusted setups needed first, we need to find the circuits we're going to do the setup on
  const circuitsToSetup = await await walk(config.CIRCUITS_HOME);
  // then we'll get all of the vks (some may not exist but we'll handle that in
  // a moments). We'll grab promises and then resolve them after the loop.
  const vks = [];

  for (const circuit of circuitsToSetup) {
    logger.debug(`checking for existing setup for ${circuit}`);

    const folderpath = circuit.slice(0, -7); // remove the .circom extension
    const r = await axios.get(`${config.PROTOCOL}${config.CIRCOM_WORKER_HOST}/vk`, {
      params: { folderpath },
    });
    vks.push(r.data.vk);
  }

  const circuitHashes = [];
  const oldCircuitHashes = [];

  // some or all of the vks will be undefined, so we need to run a trusted setup on these
  for (let i = 0; i < vks.length; i++) {
    const circuit = circuitsToSetup[i];

    const fileBuffer = fs.readFileSync(`./circuits/${circuit}`);
    const hcircuit = `0x${crypto.createHash('md5').update(fileBuffer).digest('hex')}`;
    circuitHashes[i] = hcircuit.slice(0, 12);

    const checkHash = await axios.post(
      `${config.PROTOCOL}${config.CIRCOM_WORKER_HOST}/check-circuit-hash`,
      {
        filepath: circuit,
        hash: hcircuit,
      },
    );

    if (checkHash.data.differentHash || !vks[i] || config.ALWAYS_DO_TRUSTED_SETUP) {
      try {
        if (checkHash.data.differentHash && checkHash.data.previousHash) {
          oldCircuitHashes.push(utils.ensure0x(checkHash.data.previousHash).slice(0, 12));
        }
        logger.info({
          msg: 'No existing verification key. Fear not, I will make a new one: calling generate keys',
          circuit,
        });

        const res2 = await axios.post(
          `${config.PROTOCOL}${config.CIRCOM_WORKER_HOST}/generate-keys`,
          {
            filepath: circuit,
            curve: config.CURVE,
            provingScheme: config.PROVING_SCHEME,
            backend: config.BACKEND,
          },
        );
        vks[i] = res2.data.vk;
      } catch (err) {
        logger.error(err);
      }
    } else {
      logger.info({
        msg: 'Verification key exists: trusted setup skipped',
        circuit,
      });
    }
  }

  logger.debug(`Getting key registry contract`);
  const keyRegistry = await waitForContract('State');
  logger.debug(`Got key registry contract`);

  // we should register the vk now
  for (let i = 0; i < vks.length; i++) {
    const circuit = circuitsToSetup[i];
    const vk = vks[i];
    logger.info(`Registering verification key for ${circuit}`);
    try {
      delete vk.protocol;
      delete vk.curve;
      delete vk.nPublic;

      logger.trace('vk:', vk);
      const vkArray = Object.values(vk).flat(Infinity); // flatten the Vk array of arrays because that's how Key_registry.sol likes it.
      const circuitName = circuit.slice(0, -7); // remove the .circom extension

      // The selector will be the first 40 bits of the hash
      const circuitHash = circuitHashes[i];

      logger.info({
        msg: `The circuit ${circuitName} has the following hash: ${circuitHash}`,
      });

      const call = keyRegistry.methods.registerVerificationKey(
        BigInt(circuitHash),
        vkArray,
        config.VK_IDS[circuitName].isEscrowRequired,
        config.VK_IDS[circuitName].isWithdrawing,
      );

      // when using a private key, we shouldn't assume an unlocked account and we sign the transaction directly
      // on networks like Edge, there's no account management so we need to encodeABI()
      // since methods like send() don't work
      if (config.ETH_PRIVATE_KEY) {
        await Web3.submitRawTransaction(call.encodeABI(), keyRegistry.options.address);
      } else {
        await call.send();
      }
    } catch (err) {
      logger.error(`Error registering key ${err}`);
      throw err;
    }
  }

  // Delete deprecated verification keys
  for (let i = 0; i < oldCircuitHashes.length; ++i) {
    const oldCircuitHash = oldCircuitHashes[i];
    logger.info(`Removing deprecated verification key for ${oldCircuitHash}`);
    try {
      const call = keyRegistry.methods.deleteVerificationKey(BigInt(oldCircuitHash));

      // when using a private key, we shouldn't assume an unlocked account and we sign the transaction directly
      // on networks like Edge, there's no account management so we need to encodeABI()
      // since methods like send() don't work
      if (config.ETH_PRIVATE_KEY) {
        await Web3.submitRawTransaction(call.encodeABI(), keyRegistry.options.address);
        logger.debug('Transaction submitted');
      } else {
        await call.send();
        logger.warn('Attempting to submit a transaction using an unlocked account');
      }
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }
}

export default { setupCircuits, waitForWorker };
