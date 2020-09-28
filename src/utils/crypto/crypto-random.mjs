/**
Simple routine to create a cryptographically sound random.
*/

import crypto from 'crypto';
import { GN } from '../general-number/general-number.mjs';

async function rand(bytes) {
  const buf = await crypto.randomBytes(bytes);
  return new GN(buf.toString('hex'), 'hex');
}

export default rand;
