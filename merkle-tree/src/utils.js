/**
@module utils.js
@author Westlad,Chaitanya-Konda,iAmMichaelConnor
@desc Set of utilities
*/

const crypto = require('crypto');
const { Buffer } = require('safe-buffer');

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

/**
Utility function to:
- convert each item in items to a 'buffer' of bytes (2 hex values), convert those bytes into decimal representation
- 'concatenate' each decimally-represented byte together into 'concatenated bytes'
- hash the 'buffer' of 'concatenated bytes' (sha256) (sha256 returns a hex output)
- truncate the result to the right-most 64 bits
Return:
createHash: we're creating a sha256 hash
update: [input string to hash (an array of bytes (in decimal representaion) [byte, byte, ..., byte] which represents the result of: item1, item2, item3. Note, we're calculating hash(item1, item2, item3) ultimately]
digest: [output format ("hex" in our case)]
slice: [begin value] outputs the items in the array on and after the 'begin value'
*/
function concatenateThenHash(...items) {
  const concatvalue = items
    .map(item => Buffer.from(strip0x(item), 'hex'))
    .reduce((acc, item) => concatenate(acc, item));

  const h = `0x${crypto
    .createHash('sha256')
    .update(concatvalue, 'hex')
    .digest('hex')}`;
  return h;
}

export default {
  ensure0x,
  strip0x,
  concatenate,
  concatenateThenHash,
};
