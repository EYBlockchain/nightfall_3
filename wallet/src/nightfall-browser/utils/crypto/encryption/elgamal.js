/**
functions to support El-Gamal cipherText over a BabyJubJub curve
*/

import config from 'config';
import utils from '../../../../common-files/utils/crypto/merkle-tree/utils';
import { squareRootModPrime, addMod, mulMod } from '../../../../common-files/utils/crypto/number-theory';
import modDivide from './modular-division'; // TODO REPLACE WITH NPM VERSION
import { hashToCurve, hashToCurveYSqrt, curveToHash } from './elligator2';

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

/** A useful function that takes a curve point and throws away the x coordinate
retaining only the y coordinate and the odd/eveness of the x coordinate (plays the
part of a sign in mod arithmetic with a prime field).  This loses no information
because we know the curve that relates x to y and the odd/eveness disabiguates the two
possible solutions. So it's a useful data compression.
TODO - probably simpler to use integer arithmetic rather than binary manipulations
*/
function edwardsCompress(p) {
  const px = p[0];
  const py = p[1];
  const xBits = px.toString(2).padStart(256, '0');
  const yBits = py.toString(2).padStart(256, '0');
  const sign = xBits[255] === '1' ? '1' : '0';
  const yBitsC = sign.concat(yBits.slice(1)); // add in the sign bit
  const y = utils.ensure0x(BigInt('0b'.concat(yBitsC)).toString(16).padStart(64, '0')); // put yBits into hex
  return y;
}

function edwardsDecompress(y) {
  const py = BigInt(y).toString(2).padStart(256, '0');
  const sign = py[0];
  const yfield = BigInt(`0b${py.slice(1)}`); // remove the sign encoding
  if (yfield > Fp || yfield < 0) throw new Error(`y cordinate ${yfield} is not a field element`);
  // 168700.x^2 + y^2 = 1 + 168696.x^2.y^2
  const y2 = mulMod([yfield, yfield], Fp);
  const x2 = modDivide(
    addMod([y2, BigInt(-1)], Fp),
    addMod([mulMod([JUBJUBD, y2], Fp), -JUBJUBA], Fp),
    Fp,
  );
  if (x2 === 0n && sign === '0') return BABYJUBJUB.INFINITY;
  let xfield = squareRootModPrime(x2, Fp);
  const px = BigInt(xfield).toString(2).padStart(256, '0');
  if (px[255] !== sign) xfield = Fp - xfield;
  const p = [xfield, yfield];
  if (!isOnCurve(p)) throw new Error('The computed point was not on the Babyjubjub curve');
  return p;
}

export { dec, enc, scalarMult, edwardsCompress, edwardsDecompress };
