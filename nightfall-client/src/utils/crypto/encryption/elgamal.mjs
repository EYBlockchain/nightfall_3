/**
functions to support El-Gamal cipherText over a BabyJubJub curve
*/

import config from 'config';
import { squareRootModPrime, addMod, mulMod } from 'common-files/utils/crypto/number-theory.mjs';
import { modDivide } from 'common-files/utils/crypto/modular-division.mjs'; // TODO REPLACE WITH NPM VERSION
import { hashToCurve, hashToCurveYSqrt, curveToHash } from './elligator2.mjs';

const { BABYJUBJUB, BN128_GROUP_ORDER } = config;

const one = BigInt(1);
const { JUBJUBE, JUBJUBC, JUBJUBD, JUBJUBA, GENERATOR } = BABYJUBJUB;
const Fp = BigInt(BN128_GROUP_ORDER); // the prime field used with the curve E(Fp)
const Fq = JUBJUBE / JUBJUBC;

function isOnCurve(p) {
  const { JUBJUBA: a, JUBJUBD: d } = BABYJUBJUB;
  const uu = (p[0] * p[0]) % Fp;
  const vv = (p[1] * p[1]) % Fp;
  const uuvv = (uu * vv) % Fp;
  return (a * uu + vv) % Fp === (one + d * uuvv) % Fp;
}

// // is On Montgomery curve By^2 = x^3 + Ax^2 + x
// function isOnCurveMF(p) {
//   const { MONTA: a, MONTB: b } = BABYJUBJUB;
//   const u = p[0];
//   const uu = (p[0] * p[0]) % Fp;
//   const uuu = (p[0] * p[0] * p[0]) % Fp;
//   const vv = (p[1] * p[1]) % Fp;
//   return (b * vv) % Fp === (uuu + a * uu + u) % Fp;
// }

function negate(g) {
  return [Fp - g[0], g[1]]; // this is wierd - we negate the x coordinate, not the y with babyjubjub!
}

/**
Point addition on the babyjubjub curve TODO - MOD P THIS
*/
function add(p, q) {
  const { JUBJUBA: a, JUBJUBD: d } = BABYJUBJUB;
  const u1 = p[0];
  const v1 = p[1];
  const u2 = q[0];
  const v2 = q[1];
  const uOut = modDivide(u1 * v2 + v1 * u2, one + d * u1 * u2 * v1 * v2, Fp);
  const vOut = modDivide(v1 * v2 - a * u1 * u2, one - d * u1 * u2 * v1 * v2, Fp);
  if (!isOnCurve([uOut, vOut])) throw new Error('Addition point is not on the babyjubjub curve');
  return [uOut, vOut];
}

/**
Scalar multiplication on a babyjubjub curve
@param {String} scalar - scalar mod q (will wrap if greater than mod q, which is probably ok)
@param {Object} h - curve point in u,v coordinates
*/
function scalarMult(scalar, h, form = 'Edwards') {
  const { INFINITY } = BABYJUBJUB;
  const a = ((BigInt(scalar) % Fq) + Fq) % Fq; // just in case we get a value that's too big or negative
  const exponent = a.toString(2).split(''); // extract individual binary elements
  let doubledP = [...h]; // shallow copy h to prevent h being mutated by the algorithm
  let accumulatedP = INFINITY;
  for (let i = exponent.length - 1; i >= 0; i--) {
    const candidateP = add(accumulatedP, doubledP, form);
    accumulatedP = exponent[i] === '1' ? candidateP : accumulatedP;
    doubledP = add(doubledP, doubledP, form);
  }
  if (!isOnCurve(accumulatedP))
    throw new Error('Scalar multiplication point is not on the babyjubjub curve');
  return accumulatedP;
}

/**
Converting Montgomery point to Twisted Edwards point
@param {String} p - point in Montgomery form
*/
function montgomeryToTwistedEdwards(p) {
  if (p[0] === BigInt(0) && p[1] === BigInt(0) && p.length === 2)
    return [BigInt(0), BigInt(Fp - BigInt(1))]; // M -> T [0,0] -> [0,-1]
  const u = p[0];
  const v = p[1];
  const x = modDivide(u, v, Fp);
  const y = modDivide(u - one, u + one, Fp);
  return [x, y];
}

/**
Converting Twisted Edwards point to Montgomery point
@param {String} p - point in Twisted Edwards form
*/
function twistedEdwardsToMontgomery(p) {
  if (p[0] === BigInt(0) && p[1] === BigInt(Fp - BigInt(1)) && p.length === 2)
    return [BigInt(0), BigInt(0)]; // T -> M [0,-1] -> [0,0]
  const x = p[0];
  const y = p[1];
  const u = modDivide(one + y, one - y, Fp);
  const v = modDivide(one + y, (one - y) * x, Fp);
  return [u, v];
}

/**
Performs El-Gamal cipherText
@param {Array(String)} strings - array containing the hex strings to be encrypted
@param {String} ephemeralKeys - random values mod Fq. They must be unique and changed each time this function is called
@param {String} publicKey - public key to encrypt with
*/
function enc(ephemeralKeys, strings, publicKey) {
  if (ephemeralKeys.length < strings.length) {
    throw new Error(
      'The number of random secrets must be greater than or equal to the number of messages',
    );
  }
  // We can't directly encrypt hex strings.  We can encrypt a curve point however,
  // so we convert a string to a curve point using hash to curve
  const messages = strings.map(e => hashToCurve(e));
  // We convert this to Twisted Edwards point because Elligator 2 is applied on top of TE and not Montgomery curves
  const messagesTE = messages.map(e => {
    return montgomeryToTwistedEdwards(e);
  });
  // we get square roots calculated in hash to curve because it is quicker to prove squaring of two numbers than the square root value in zk circuits
  const squareRootsElligator2 = strings.map(e => hashToCurveYSqrt(e));
  // now we use the public keys and random number to generate shared secrets
  const sharedSecrets = ephemeralKeys.map(e => {
    // eslint-disable-next-line valid-typeof
    if (typeof e !== 'bigint')
      throw new Error(
        'The random secret chosen for cipherText should be a BigInt, unlike the messages, which are hex strings',
      );
    if (publicKey === undefined) throw new Error('Trying to encrypt with a undefined public key');
    return scalarMult(e, publicKey);
  });
  // finally, we can encrypt the messages using the shared secrets
  const c = ephemeralKeys.map(ephemeralKey => {
    return scalarMult(ephemeralKey, GENERATOR);
  });
  const encryptedMessages = messagesTE.map((message, i) => {
    return add(message, sharedSecrets[i]);
  });
  const cipherText = [...c, ...encryptedMessages];
  return { ephemeralKeys, cipherText, squareRootsElligator2 };
}

/**
Decrypt the above
*/
function dec(cipherText, privateKey) {
  const c = cipherText.slice(0, cipherText.length / 2); // this encrypts the sender's random secret, needed for shared-secret generation
  const encryptedMessages = cipherText.slice(cipherText.length / 2, cipherText.length);
  // recover the shared secrets
  const sharedSecrets = c.map(sharedSecret => {
    if (privateKey === undefined)
      throw new Error('Trying to decrypt with an undefined private key');
    return scalarMult(privateKey, sharedSecret);
  });
  // then decrypt
  const messagePoints = encryptedMessages.map((encryptedMessage, i) =>
    add(encryptedMessage, negate(sharedSecrets[i])),
  );
  const messagesMONT = messagePoints.map(messagePoint => twistedEdwardsToMontgomery(messagePoint));
  const messages = messagesMONT.map(messagePoint => curveToHash(messagePoint));
  return messages;
}

/**
function to compress an edwards point. If we throw away the y coodinate, we can
recover it using the curve equation later, and save almost half the storage.
Unfortunately that gives us a choice of two y points because of the
quadratic term in y.  We have two solutions. We could save the sign of y or,
in a prime field, we can save the parity of y: if y is even, -y (=p-y) must
be odd and vice versa. We do the latter because it's slightly easier to
extract.
*/
function edwardsCompress(point) {
  const [x, y] = point.map(p => BigInt(p));
  // compute whether y is odd or even
  const parity = y.toString(2).slice(-1); // extract last binary digit
  // add the parity bit to the x cordinate (x,y are 254 bits long - the final
  // string is 256 bits to fit with an Ethereum word)
  const compressedBinary = parity.concat(x.toString(2).padStart(255, '0'));
  const compressedBigInt = BigInt(`0b${compressedBinary}`);
  return `0x${compressedBigInt.toString(16)}`;
}

function edwardsDecompress(x) {
  const px = BigInt(x).toString(2).padStart(256, '0');
  const sign = px[0];
  const xfield = BigInt(`0b${px.slice(1)}`); // remove the sign encoding
  if (xfield > Fp || xfield < 0) throw new Error(`x cordinate ${xfield} is not a field element`);
  // 168700.x^2 + y^2 = 1 + 168696.x^2.y^2
  const x2 = mulMod([xfield, xfield], Fp);
  const y2 = modDivide(
    addMod([mulMod([JUBJUBA, x2], Fp), -1n], Fp),
    addMod([mulMod([JUBJUBD, x2], Fp), -1n], Fp),
    Fp,
  );
  if (y2 === 0n && sign === '0') return BABYJUBJUB.INFINITY;
  let yfield = squareRootModPrime(y2, Fp);
  if (yfield.toString(2).slice(-1) !== sign) yfield = Fp - yfield;
  const p = [xfield, yfield];
  if (!isOnCurve(p)) throw new Error('The computed point was not on the Babyjubjub curve');
  return p;
}

export { dec, enc, scalarMult, edwardsCompress, edwardsDecompress };
