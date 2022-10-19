import logger from '../logger.mjs';

export const TX_GAS_DEFAULT = 4000000;
export const TX_GAS_MULTIPLIER = 2;

/**
 * Estimate the amount of gas that will be needed to submit a transaction (tx)
 *
 * The underlying RPC `eth_estimateGas` will check the balance of the sender,
 * this means that even though the call doesn't consume any gas,
 * the `from` address must have enough gas to execute the tx
 *
 * @async
 * @function estimateGas
 * @param {TransactionConfig} tx A tx object
 * @param {Web3} web3
 * @returns {Promise<number>}
 */
export async function estimateGas(tx, web3) {
  logger.debug({ msg: 'Estimate gas for transaction', tx });

  let gas;
  try {
    gas = await web3.eth.estimateGas(tx);
    logger.debug({ msg: 'Gas estimated at', gas });
  } catch (error) {
    gas = TX_GAS_DEFAULT;
    logger.warn({ msg: 'Gas estimation failed, use default', gas });
  }

  return Math.ceil(gas * TX_GAS_MULTIPLIER); // 50% seems a more than reasonable buffer
}
