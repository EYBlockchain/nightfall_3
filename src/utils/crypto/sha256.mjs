import crypto from 'crypto';
import { strip0x } from '../general-number/conversions.mjs';
import { GN } from '../general-number/general-number.mjs';

/**
Utility function to concatenate two hex strings and return as buffer
Looks like the inputs are somehow being changed to decimal!
@param {string} a
@param {string} b
*/
export const concatenate = (a, b) => {
  const length = a.length + b.length;
  const buffer = Buffer.allocUnsafe(length); // creates a buffer object of length 'length'
  for (let i = 0; i < a.length; i += 1) {
    buffer[i] = a[i];
  }
  for (let j = 0; j < b.length; j += 1) {
    buffer[a.length + j] = b[j];
  }
  return buffer;
};

/**
@param {Array[GN]} generalValues
 */
export const sha256 = generalValues => {
  const preimage = generalValues
    .map(item => Buffer.from(strip0x(item.hex(32)), 'hex'))
    .reduce((acc, item) => concatenate(acc, item));

  const h = `0x${crypto
    .createHash('sha256')
    .update(preimage, 'hex')
    .digest('hex')}`;
  return new GN(h);
};
