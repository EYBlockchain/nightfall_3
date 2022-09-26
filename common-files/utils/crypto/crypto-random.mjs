/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */
/**
Simple routine to create a cryptographically sound random.
*/

import crypto from 'crypto';
import gen from 'general-number';

const { GN, generalise } = gen;

async function rand(bytes) {
  const buf = await crypto.randomBytes(bytes);
  return new GN(buf.toString('hex'), 'hex');
}

// Rejection sampling for a value < bigIntValue
async function randValueLT(bigIntValue) {
  let genVal = Infinity;
  const MAX_ATTEMPTS = 1000;
  const minimumBytes = Math.ceil(generalise(bigIntValue).binary.length / 8);
  let counter = 0;
  do {
    // eslint-disable-next-line no-await-in-loop
    genVal = await rand(minimumBytes);
    counter++;
  } while (genVal.bigInt >= bigIntValue || genVal.bigInt === 0 || counter === MAX_ATTEMPTS);
  if (counter === MAX_ATTEMPTS) throw new Error("Couldn't make a number below target value");
  return genVal;
}

export { rand, randValueLT };
