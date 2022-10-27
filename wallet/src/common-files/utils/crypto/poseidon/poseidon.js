/* eslint-disable no-param-reassign */
// Implements the Poseidon hash, drawing on the ZoKrates implementation
import gen from 'general-number';
import poseidonConstants from './poseidon-constants.js';
import { addMod, mulMod, powerMod } from '../number-theory.js';

const { C, M, SNARK_SCALAR_FIELD: q } = poseidonConstants;
const { generalise } = gen;

function ark(state, c, it) {
  const N = state.length;
  for (let i = 0; i < N; i++) {
    state[i] = addMod([state[i], c[it + i]], q);
  }
  return state;
}

function sbox(state, f, p, r) {
  const N = state.length;
  state[0] = powerMod(state[0], 5n, q);
  for (let i = 1; i < N; i++) {
    state[i] = r < f / 2 || r >= f / 2 + p ? powerMod(state[i], 5n, q) : state[i];
  }
  return state;
}

function mix(state, m) {
  const N = state.length;
  const out = new Array(N).fill(0n);
  for (let i = 0; i < N; i++) {
    let acc = 0n;
    for (let j = 0; j < N; j++) {
      acc = addMod([acc, mulMod([state[j], m[i][j]], q)], q);
    }
    out[i] = acc;
  }
  return out;
}

function poseidonHash(_inputs) {
  if (_inputs.length > 6) throw new Error('To many inputs to Poseidon hash');
  // convert generalnumber to BigInts, which Poseidon uses internally
  const inputs = _inputs.map(i => BigInt(i.bigInt % q));
  const N = inputs.length;
  const t = N + 1;
  const roundsP = [56, 57, 56, 60, 60, 63, 64, 63];
  const f = 8;
  const p = roundsP[t - 2];
  const c = C[t - 2];
  const m = M[t - 2];

  let state = new Array(t).fill(0n);
  for (let i = 1; i < t; i++) {
    state[i] = inputs[i - 1];
  }
  for (let r = 0; r < f + p; r++) {
    state = ark(state, c, r * t);
    state = sbox(state, f, p, r);
    state = mix(state, m);
  }
  return generalise(state[0]);
}

export default poseidonHash;
