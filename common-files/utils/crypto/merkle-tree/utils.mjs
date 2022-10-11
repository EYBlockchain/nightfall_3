/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
@module utils.js
@author Westlad,ChaitanyaKonda,iAmMichaelConnor
@desc Set of utilities
*/
import config from 'config';
import createKeccakHash from 'keccak';
import crypto from 'crypto';
import sb from 'safe-buffer';
import { generalise } from 'general-number';
import logger from '../../logger.mjs';
import mimcHashFunction from '../mimc/mimc.mjs';
import poseidonHashFunction from '../poseidon/poseidon.mjs';

const { Buffer } = sb;

function padArray(arr, padWith, n) {
  if (arr === undefined) return generalise([...Array.from({ length: n }, () => padWith)]);
  if (arr.length < n) {
    const nullPadding = generalise(Array.from({ length: n - arr.length }, () => padWith));
    return arr.concat(nullPadding);
  }
  return arr;
}

function parseToDigitsArray(str, base) {
  const digits = str.split('');
  const ary = [];
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const n = parseInt(digits[i], base);
    if (Number.isNaN(n)) return null;
    ary.push(n);
  }
  return ary;
}

function add(x, y, base) {
  const z = [];
  const n = Math.max(x.length, y.length);
  let carry = 0;
  let i = 0;
  while (i < n || carry) {
    const xi = i < x.length ? x[i] : 0;
    const yi = i < y.length ? y[i] : 0;
    const zi = carry + xi + yi;
    z.push(zi % base);
    carry = Math.floor(zi / base);
    i += 1;
  }
  return z;
}

/** Helper function for the converting any base to any base
 Returns a*x, where x is an array of decimal digits and a is an ordinary
 JavaScript number. base is the number base of the array x.
 */
function multiplyByNumber(num, x, base) {
  if (num < 0) return null;
  if (num === 0) return [];

  let result = [];
  let power = x;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-bitwise
    if (num & 1) {
      result = add(result, power, base);
    }
    num >>= 1; // eslint-disable-line
    if (num === 0) break;
    power = add(power, power, base);
  }
  return result;
}

/** Helper function for the converting any base to any base
 */
function convertBase(str, fromBase, toBase) {
  const digits = parseToDigitsArray(str, fromBase);
  if (digits === null) return null;

  let outArray = [];
  let power = [1];
  for (let i = 0; i < digits.length; i += 1) {
    // invariant: at this point, fromBase^i = power
    if (digits[i]) {
      outArray = add(outArray, multiplyByNumber(digits[i], power, toBase), toBase);
    }
    power = multiplyByNumber(fromBase, power, toBase);
  }

  let out = '';
  for (let i = outArray.length - 1; i >= 0; i -= 1) {
    out += outArray[i].toString(toBase);
  }
  // if the original input was equivalent to zero, then 'out' will still be empty ''. Let's check for zero.
  if (out === '') {
    let sum = 0;
    for (let i = 0; i < digits.length; i += 1) {
      sum += digits[i];
    }
    if (sum === 0) out = '0';
  }

  return out;
}

/**
utility function to check that a string has a leading 0x (which the Solidity
compiler uses to check for a hex string).  It adds it if it's not present. If
it is present then it returns the string unaltered
*/
function ensure0x(hex = '') {
  const hexString = hex.toString();
  if (typeof hexString === 'string' && hexString.indexOf('0x') !== 0) {
    return `0x${hexString}`;
  }
  return hexString;
}

// Converts integer value strings to hex values
function decToHex(decStr) {
  const hex = ensure0x(convertBase(decStr, 10, 16));
  return hex;
}

/**
utility function to remove a leading 0x on a string representing a hex number.
If no 0x is present then it returns the string un-altered.
*/
function strip0x(hex) {
  if (typeof hex === 'undefined') return '';
  if (typeof hex === 'string' && hex.indexOf('0x') === 0) {
    return hex.slice(2).toString();
  }
  return hex.toString();
}

/**
utility function to check that a string is hexadecimal
*/
function isHex(value) {
  if (typeof value !== 'string') return false;
  if (value.indexOf('0x') !== 0) return false;
  const regexp = /^[0-9a-fA-F]+$/;
  return regexp.test(strip0x(value));
}

/**
Utility function to concatenate two hex strings and return as buffer
Looks like the inputs are somehow being changed to decimal!
*/
function concatenate(a, b) {
  const length = a.length + b.length;
  const buffer = Buffer.allocUnsafe(length); // creates a buffer object of length 'length'
  for (let i = 0; i < a.length; i += 1) {
    buffer[i] = a[i];
  }
  for (let j = 0; j < b.length; j += 1) {
    buffer[a.length + j] = b[j];
  }
  return buffer;
}

function keccak256Hash(...items) {
  const concatvalue = items
    .map(item => Buffer.from(strip0x(item), 'hex'))
    .reduce((acc, item) => concatenate(acc, item));
  return `0x${createKeccakHash('keccak256').update(concatvalue, 'hex').digest('hex')}`;
}

function mimcHash(...msgs) {
  const curve = !config.CURVE || config.CURVE === 'bn128' ? 'ALT_BN_254' : config.CURVE;
  logger.trace(`curve: ${config.CURVE}`);
  return `0x${mimcHashFunction(msgs, curve)
    .toString(16) // hex string - can remove 0s
    .padStart(64, '0')}`; // so pad
}

function shaHash(...items) {
  const concatvalue = items
    .map(item => Buffer.from(strip0x(item), 'hex'))
    .reduce((acc, item) => concatenate(acc, item));

  return `0x${crypto.createHash('sha256').update(concatvalue, 'hex').digest('hex')}`;
}

function poseidonHash(...items) {
  const inputs = items.map(i => generalise(i));
  const hash = poseidonHashFunction(inputs);
  return hash.hex(32);
}

function concatenateThenHash(hashType, ...items) {
  let h;
  if (hashType === 'mimc') {
    h = mimcHash(...items);
  } else if (hashType === 'sha256') {
    h = shaHash(...items);
  } else if (hashType === 'keccak256') {
    h = keccak256Hash(...items);
  } else if (hashType === 'poseidon') {
    h = poseidonHash(...items);
  } else {
    // can be changed to other hash
    h = mimcHash(...items);
  }
  return h;
}

export default {
  convertBase,
  decToHex,
  ensure0x,
  strip0x,
  isHex,
  concatenate,
  mimcHash,
  shaHash,
  poseidonHash,
  concatenateThenHash,
  padArray,
};
