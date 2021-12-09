// ignore unused exports default

/**
Simple routine to create a cryptographically sound random.
*/

import crypto from 'crypto';
import gen from 'general-number';

const { GN } = gen;

async function rand(bytes) {
  const buf = await crypto.randomBytes(bytes);
  return new GN(buf.toString('hex'), 'hex');
}

export default rand;
