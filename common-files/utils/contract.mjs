/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

import { web3, getContractAddress } from './web3.mjs';
import logger from './logger.mjs';

/**
 * Function that tries to get a (named) contract instance and, if it fails, will
 * retry after 3 seconds.  After RETRIES attempts, it will give up and throw.
 * This is useful in case nightfall-optimist comes up before the contract
 * is fully deployed.
 */
// eslint-disable-next-line import/prefer-default-export
export async function waitForContract(contractName) {
  let errorCount = 0;
  let error;
  let instance;
  while (errorCount < 50) {
    try {
      error = undefined;
      const { address } = await getContractAddress(contractName); // eslint-disable-line no-await-in-loop
      if (address === undefined) throw new Error(`${contractName} contract address was undefined`);
      instance = web3.getContractInstance(contractName, address);
      return instance;
    } catch (err) {
      error = err;
      errorCount++;
      logger.warn(`Unable to get a ${contractName} contract instance will try again in 3 seconds`);
      await new Promise(resolve => setTimeout(() => resolve(), 3000)); // eslint-disable-line no-await-in-loop
    }
  }
  if (error) throw error;
  return instance;
}
