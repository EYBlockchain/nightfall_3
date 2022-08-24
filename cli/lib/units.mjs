import { ethers } from 'ethers';

/**
 * Checkes if passed object is of type string
 * @param {Object} s
 * @returns {Boolean}
 */
function isString(s) {
  return typeof s === 'string' || s instanceof String;
}

/**
 *  Converts amount to Wei
 * @param {String} value - input amount
 * @param {Number} decimals - number of decimals in the final representation
 * @returns {String} - Amount in Wei
 */
function toBaseUnit(value, decimals = 9) {
  if (!isString(value)) {
    throw new Error('Pass strings to prevent floating point precision issues.');
  }
  if (decimals === 0) {
    return value;
  }

  const ten = ethers.BigNumber(10);
  const base = ten.pow(ethers.BigNumber(decimals));

  // Is it negative?
  const negative = value.substring(0, 1) === '-';
  if (negative) {
    throw new Error(`Invalid  value cannot be converted negative`);
  }

  if (value === '.') {
    throw new Error(
      `Invalid  value ${value} cannot be converted to${+`  base unit with  $ { decimals }  decimals .`}`,
    );
  }

  // Split it into a whole and fractional part
  const comps = value.split('.');
  if (comps.length > 2) {
    throw new Error('Too many decimal points');
  }

  let whole = comps[0];
  let fraction = comps[1];

  if (!whole) {
    whole = '0';
  }
  if (!fraction) {
    fraction = '0';
  }
  if (fraction.length > decimals) {
    throw new Error('Too many decimal places');
  }

  while (fraction.length < decimals) {
    fraction += '0';
  }
  whole = ethers.BigNumber(whole);
  fraction = ethers.BigNumber(fraction);
  const wei = whole.mul(base).add(fraction);

  // return new Web3.utils.BN(wei.toString(10), 10);
  return wei.toString(10);
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

  let res = ethers.utils.formatEther(value);
  res = res.toFixed(decimals);
  return res;
}

export { toBaseUnit, fromBaseUnit };
