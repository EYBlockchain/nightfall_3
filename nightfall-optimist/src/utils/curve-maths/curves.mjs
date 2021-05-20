/**
module for manupulating elliptic curve points for an alt-bn128 curve. This
is the curve that Ethereum currently has pairing precompiles for. All the
return values are BigInts (or arrays of BigInts).
*/
import config from 'config';
import { mulMod, addMod, squareRootModPrime } from './number-theory.mjs';
import Proof from '../../classes/proof.mjs';

const { COMPRESS_G2, BN128_PRIME_FIELD } = config;

/**
function to compress a G1 point. If we throw away the y coodinate, we can
recover it using the curve equation later, and save almost half the storage.
Unfortunately that gives us a choice of two y points because of the
quadratic term in y.  We have two solutions. We could save the sign of y or,
in a prime field, we can save the parity of y: if y is even, -y (=p-y) must
be odd and vice versa. We do the latter because it's slightly easier to
extract.
*/
export async function compressG1(point) {
  const [x, y] = point.map(p => BigInt(p));
  // compute whether y is odd or even
  const parity = y.toString(2).slice(-1); // extract last binary digit
  // add the parity bit to the x cordinate (x,y are 254 bits long - the final
  // string is 256 bits to fit with an Ethereum word)
  const compressed = parity.concat(x.toString(2).padStart(255, '0'));
  return BigInt(`0b${compressed}`);
}

/**
The G2 point works over the complex extension field F_p^2 = F_p[i] / (i^2 + 1) so here x,y are complex! Thus the point is of the form [[xr, xi],[yr, yi]]
*/
export function compressG2(point) {
  const [[xr, xi], [yr, yi]] = point.map(c => c.map(p => BigInt(p)));
  return [compressG1([xr, yr]), compressG1([xi, yi])];
}

/**
This compresses a GM17 proof object in its entirety, returning promises of a
flattened, compressed result. That's nice because you can await it with a
Promise.all. We can turn off G2 compression as G2 decompression isn't done yet.
It can cope with the proof as an object or as a flattened array.
*/
export async function compressProof(_proof) {
  let proof;
  if (Array.isArray(_proof)) {
    if (_proof.length !== 8) throw new Error('Flat proof array should have length 8');
    proof = new Proof(_proof);
  } else proof = _proof;
  return [compressG1(proof.a), compressG2(proof.b), compressG1(proof.c)].flat();
}

/**
solving Y^2 = X^3 + 3 over p
*/
export async function decompressG1(xin) {
  // first, extract the parity bit
  const xbin = BigInt(xin)
    .toString(2)
    .padStart(256, '0');
  const parity = xbin[0];
  // then convert the rest into a BigInt
  const x = BigInt(`0b${xbin.slice(1)}`);
  const x3 = mulMod([x, x, x]);
  const y2 = addMod([x3, 3n]);
  let y = squareRootModPrime(y2);
  if (parity !== y.toString(2).slice(-1)) y = BN128_PRIME_FIELD - y;
  return [x, y];
}

/**
solving Y^2 = X^3 + 3/(i+9)
*/
export async function decompressG2(cin) {
  throw new Error('Not yet implemented');
}

export async function decompressProof(compressedProof) {
  // compressed proofs are always just flat arrays. We also return a flattend
  // proof array as we rarely need the object.  If we do we can construct one
  // from the flattened array as an instance of the Proof class. This returns
  // and array of promises so be sure to await Promise.all.
  const [aCompressed, bCompressedReal, bCompressedImaginary, cCompressed] = compressedProof;
  return [
    decompressG1(aCompressed),
    decompressG2([bCompressedReal, bCompressedImaginary]),
    decompressG1(cCompressed),
  ].flat(2);
}
