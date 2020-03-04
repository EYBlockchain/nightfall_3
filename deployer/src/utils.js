/**
@module utils.js
@author Westlad,Chaitanya-Konda,iAmMichaelConnor
@desc Set of utilities
*/
import config from 'config';
import createKeccakHash from 'keccak';

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
Utility function to convert a string into a hex representation of fixed length.
@param {string} str - the string to be converted
@param {int} outLength - the length of the output hex string in bytes (excluding the 0x)
if the string is too short to fill the output hex string, it is padded on the left with 0s
if the string is too long, an error is thrown
*/
function utf8StringToHex(str, outLengthBytes) {
  const outLength = outLengthBytes * 2; // work in characters rather than bytes
  const buf = Buffer.from(str, 'utf8');
  let hex = buf.toString('hex');
  if (outLength < hex.length)
    throw new Error('String is to long, try increasing the length of the output hex');
  hex = hex.padStart(outLength, '00');
  return ensure0x(hex);
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
function addMod(addMe, m) {
  return addMe.reduce((e, acc) => (e + acc) % m, BigInt(0));
}

function powerMod(base, exponent, m) {
  if (m === BigInt(1)) return BigInt(0);
  let result = BigInt(1);
  let b = base % m;
  let e = exponent;
  while (e > BigInt(0)) {
    if (e % BigInt(2) === BigInt(1)) result = (result * b) % m;
    e >>= BigInt(1);
    b = (b * b) % m;
  }
  return result;
}

function keccak256Hash(item) {
  const preimage = strip0x(item);
  const h = `0x${createKeccakHash('keccak256')
    .update(preimage, 'hex')
    .digest('hex')}`;
  return h;
}

/**
mimc encryption function
@param  {String} x - the input value
@param {String} k - the key value
@param {String} seed - input seed for first round (=0n for a hash)
@param
*/
function mimcpe7(x, k, seed, roundCount, m) {
  let xx = x;
  let t;
  let c = seed;
  for (let i = 0; i < roundCount; i++) {
    c = keccak256Hash(c);
    t = addMod([xx, BigInt(c), k], m); // t = x + c_i + k
    xx = powerMod(t, BigInt(7), m); // t^7
  }
  // Result adds key again as blinding factor
  return addMod([xx, k], m);
}

function mimcpe7mp(x, k, seed, roundCount, m = BigInt(config.ZOKRATES_PRIME)) {
  let r = k;
  let i;
  for (i = 0; i < x.length; i++) {
    r = (r + (x[i] % m) + mimcpe7(x[i], r, seed, roundCount, m)) % m;
  }
  return r;
}

function mimcHash(...msgs) {
  // elipses means input stored in array called msgs
  const mimc = '0x6d696d63'; // this is 'mimc' in hex as a nothing-up-my-sleeve seed
  return `0x${mimcpe7mp(
    // '${' notation '0x${x}' -> '0x34' w/ x=34
    msgs.map(e => {
      const f = BigInt(e);
      if (f > config.ZOKRATES_PRIME) throw new Error('MiMC input exceeded prime field size');
      return f;
    }),
    BigInt(0), // k
    keccak256Hash(mimc), // seed
    91, // rounds of hashing
  )
    .toString(16) // hex string - can remove 0s
    .padStart(64, '0')}`; // so pad
}

function shaHash(...items) {
  const concatvalue = items
    .map(item => Buffer.from(strip0x(item), 'hex'))
    .reduce((acc, item) => concatenate(acc, item));

  const h = `0x${crypto
    .createHash('sha256')
    .update(concatvalue, 'hex')
    .digest('hex')}`;
  return h;
}

function concatenateThenHash(...items) {
  if (config.HASH_TYPE == SHA) {
    const h = shaHash(...items);
    return h;
  } else {
    const h = mimcHash(...items);
    return h;
  }
}


export default {
  ensure0x,
  strip0x,
  concatenate,
  concatenateThenHash,
};
