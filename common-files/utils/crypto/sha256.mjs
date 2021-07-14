import crypto from 'crypto';
import gen from 'general-number';

const { GN } = gen;

const strip0x = hex => {
  if (typeof hex === 'undefined') return '';
  if (typeof hex === 'string' && hex.indexOf('0x') === 0) {
    return hex.slice(2).toString();
  }
  return hex.toString();
};

/**
Utility function to concatenate two hex strings and return as buffer
Looks like the inputs are somehow being changed to decimal!
@param {string} a
@param {string} b
*/
const concatenate = (a, b) => {
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
const sha256 = generalValues => {
  const preimage = generalValues
    .map(item => Buffer.from(strip0x(item.hex(32)), 'hex'))
    .reduce((acc, item) => concatenate(acc, item));

  const h = `0x${crypto.createHash('sha256').update(preimage, 'hex').digest('hex')}`;
  return new GN(h);
};

export default sha256;
