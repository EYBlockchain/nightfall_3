/* ignore unused exports */

import axios from 'axios';
import logger from './logger.mjs';

/**
 * Estimate the amount of gas that will be needed to submit a transaction (tx)
 *
 * The underlying RPC `eth_estimateGas` will check the balance of the sender,
 * this means that even though the call doesn't consume any gas,
 * the `from` address must have enough gas to execute the tx
 *
 * @async
 * @function estimateGas
 * @param {object} tx A tx object
 * @param {Web3} web3
 * @param {number} gasDefault Has default
 * @param {number} gasMultiplier Buffer to apply to estimated gas - Has default
 * @returns {Promise<number>}
 */
export async function estimateGas(tx, web3, gasDefault = 4000000, gasMultiplier = 2) {
  logger.debug({ msg: 'Estimate gas for transaction...', tx });

  let gas;
  try {
    gas = await web3.eth.estimateGas(tx);
    logger.debug({ msg: 'Gas estimated at', gas });
  } catch (error) {
    gas = gasDefault;
    logger.warn({ msg: 'Gas estimation failed, use default', gas });
  }
  return Math.ceil(gas * gasMultiplier);
}

/**
 * Estimate gas price
 *
 * @async
 * @function estimateGasPrice
 * @param {string} gasEstimateEndpoint URL for querying gas prices
 * @param {Web3} web3
 * @param {number} gasPriceDefault Has default
 * @param {number} gasPriceMultiplier Buffer to apply to estimated gas price - Has default
 * @returns {Promise<number>}
 */
export async function estimateGasPrice(
  gasEstimateEndpoint,
  web3,
  gasPriceDefault = 10000000000,
  gasPriceMultiplier = 2,
) {
  logger.debug({ msg: 'Estimate gas price...' });

  let proposedGasPrice;
  try {
    const { result } = (await axios.get(gasEstimateEndpoint)).data;
    proposedGasPrice = Number(result?.ProposeGasPrice) * 10 ** 9;
    logger.debug({ msg: 'Gas price', proposedGasPrice });
  } catch (error) {
    try {
      proposedGasPrice = Number(await web3.eth.getGasPrice());
      logger.debug({ msg: 'Gas endpoint failed, web3 gas price', proposedGasPrice });
    } catch (err) {
      proposedGasPrice = gasPriceDefault;
      logger.debug({ msg: 'Gas price estimation failed, use default', proposedGasPrice });
    }
  }
  return Math.ceil(proposedGasPrice * gasPriceMultiplier);
}
