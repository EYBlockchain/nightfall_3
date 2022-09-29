// ignore unused exports modDivide, complexDivMod

// modular division
import { mulMod, addMod } from './number-theory';

const { BN128_PRIME_FIELD } = global.nightfallConstants;

// function for extended Euclidean Algorithm
// (used to find modular inverse.
function gcdExtended(a, b, _xy) {
  const xy = _xy;
  if (a === 0n) {
    xy[0] = 0n;
    xy[1] = 1n;
    return b;
  }
  const xy1 = [0n, 0n];
  const gcd = gcdExtended(b % a, a, xy1);

  // Update x and y using results of recursive call
  xy[0] = xy1[1] - (b / a) * xy1[0];
  xy[1] = xy1[0]; // eslint-disable-line prefer-destructuring

  return gcd;
}

// Function to find modulo inverse of b.
function modInverse(b, m = BN128_PRIME_FIELD) {
  const xy = [0n, 0n]; // used in extended GCD algorithm
  const g = gcdExtended(b, m, xy);
  if (g !== 1n) throw new Error('Numbers were not relatively prime');
  // m is added to handle negative x
  return ((xy[0] % m) + m) % m;
}

// Function to compute a/b mod m
export function modDivide(a, b, m = BN128_PRIME_FIELD) {
  const aa = ((a % m) + m) % m; // check the numbers are mod m and not negative
  const bb = ((b % m) + m) % m; // do we really need this?
  const inv = modInverse(bb, m);
  return (((inv * aa) % m) + m) % m;
}

/*
Function that works when a and b are complex. Note that if
a = x + iy
b = u + iv
a/b = (x+iy)/(u+iv) = (x+iy)(u-iv)/(u^2+v^2)
    = (xu+yv)/(u^2+v^2) + i(uy-vx)/(u^2+v^2)
*/
export function complexDivMod(a, b, m = BN128_PRIME_FIELD) {
  const [x, y] = a;
  const [u, v] = b;
  const denominator = addMod([mulMod([u, u], m), mulMod([v, v], m)], m);
  const realNumerator = addMod([mulMod([x, u], m), mulMod([y, v], m)], m);
  const imaginaryNumerator = addMod([mulMod([u, y], m), -mulMod([v, x], m)], m);
  return [modDivide(realNumerator, denominator, m), modDivide(imaginaryNumerator, denominator, m)];
}
