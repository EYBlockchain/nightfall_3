import createKeccakHash from 'keccak';
import config from './mimc-config.mjs';

const addMod = (addMe, m) => {
  return addMe.reduce((e, acc) => (e + acc) % m, BigInt(0));
};

const powerMod = (base, exponent, m) => {
  if (m === BigInt(1)) return BigInt(0);
  let result = BigInt(1);
  let b = base % m;
  let e = BigInt(exponent);
  while (e > BigInt(0)) {
    if (e % BigInt(2) === BigInt(1)) result = (result * b) % m;
    // eslint-disable-next-line no-bitwise
    e >>= BigInt(1);
    b = (b * b) % m;
  }
  return result;
};

const keccak256Hash = preimage => {
  const h = createKeccakHash('keccak256').update(preimage, 'hex').digest('hex');
  return h;
};

/**
mimc encryption function
@param  {String} x - the input value
@param {String} k - the key value
@param {String} seed - input seed for first round (=0n for a hash)
@param
*/
const mimcp = (x, k, seed, roundCount, exponent, m) => {
  let xx = x;
  let t;
  let c = seed;
  // eslint-disable-next-line
  for (let i = 0; i < roundCount; i++) {
    c = keccak256Hash(c);
    t = addMod([xx, BigInt(`0x${c}`), k], m); // t = x + c_i + k
    xx = powerMod(t, exponent, m); // t^7
  }
  // Result adds key again as blinding factor
  return addMod([xx, k], m);
};

// eslint-disable-next-line camelcase
const mimcp_mp = (x, k, seed, roundCount, exponent, m) => {
  let r = k;
  let i;
  for (i = 0; i < x.length; i += 1) {
    r = (r + (x[i] % m) + mimcp(x[i], r, seed, roundCount, exponent, m)) % m;
  }
  return r;
};

export const mimcHash = (_msgs, curve = 'ALT_BN_254') => {
  if (config[curve] === undefined) throw new Error('Unknown curve type');
  const msgs = _msgs.map(BigInt);
  const { rounds } = config[curve];
  const { exponent } = config[curve];
  const { modulus } = config[curve];
  const mimc = '6d696d63'; // this is 'mimc' in hex as a nothing-up-my-sleeve seed
  return mimcp_mp(
    msgs,
    BigInt(0), // k
    keccak256Hash(mimc), // seed
    rounds, // rounds of hashing
    exponent,
    modulus,
  );
};

export { mimcHash as default };
