import Web3 from 'web3';

/**
 * Checkes if passed object is of type string
 * @param {Object} s
 * @returns {Boolean}
 */
function isString(s) {
  return typeof s === 'string' || s instanceof String;
}

/**
 *  Converts amount to Eth
 * @param {String} value - input amount
 * @param {Number} decimals - number of decimals in the final representation
 * @returns {String} - Amount in Eth
 */
function fromBaseUnit(value, decimals) {
  if (!isString(value)) {
    throw new Error('Pass strings to prevent floating point precision issues.');
  }

  const { unitMap } = Web3.utils;
  const factor = 10 ** decimals;
  const unit = Object.keys(unitMap).find(key => unitMap[key] === factor.toString());

  return Web3.utils.fromWei(value, unit);
}

export default fromBaseUnit;
