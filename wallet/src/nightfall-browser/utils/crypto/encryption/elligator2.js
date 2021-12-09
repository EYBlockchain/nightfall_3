// ignore unused exports hashToCurve, hashToCurveYSqrt, curveToHash

// eslint-disable-next-line import/no-extraneous-dependencies
import config from 'config';
import {
  squareRootModPrime,
  addMod,
  mulMod,
  powerMod,
} from '../../../../common-files/utils/crypto/number-theory';
import modDivide from './modular-division';

const { BABYJUBJUB, BN128_GROUP_ORDER, ELLIGATOR2 } = config;

const one = BigInt(1);
const { MONTA, MONTB } = BABYJUBJUB;
const { U } = ELLIGATOR2;
const Fp = BigInt(BN128_GROUP_ORDER); // the prime field used with the curve E(Fp)

// χ : Fq → Fq by χ(a) = a^((q−1)/2)
function chi(a) {
  return powerMod(a, (Fp - one) / BigInt(2), Fp);
}

// // if value <= p-1//2, then positive
// function isPositive(value) {
//   return value % Fp <= modDivide(BN128_GROUP_ORDER - BigInt(1), BigInt(2), Fp);
// }

// if value > p-1//2, then negative
function isNegative(value) {
  return value % Fp > modDivide(Fp - BigInt(1), BigInt(2), Fp);
}

// if value == 0 or chi(value) == 1
function isSquare(value) {
  return value === BigInt(0) || chi(value) === BigInt(1);
}

// r∈Fq :1+ur^2!=0, A^2ur^2!=B(1+ur^2)^2
function checkR(r) {
  return (
    (BigInt(1) + ((U * r * r) % Fp)) % Fp !== BigInt(0) &&
    (MONTA * MONTA * U * r * r) % Fp !==
      (MONTB * (BigInt(1) + ((U * r * r) % Fp)) * (BigInt(1) + ((U * r * r) % Fp))) % Fp
  );
}

// v = −A/(1+ur^2),
// ε = χ(v3 +Av2 +Bv),
// x = εv − (1 − ε)A/2,
// y = −ε sqrt(x3 +Ax2 +Bx)
// r has to be BigInt
export function hashToCurve(r) {
  if (r === BigInt(0)) return [BigInt(0), BigInt(0)];
  if (checkR(r) !== true) throw new Error(`This value can't be hashed to curve using Elligator2`);
  const v = modDivide(-MONTA, one + U * r * r, Fp);
  const e = chi((v * v * v + MONTA * v * v + MONTB * v) % Fp);
  const x = ((e * v) % Fp) - modDivide((one - e) * MONTA, BigInt(2), Fp);
  let y2 = squareRootModPrime((x * x * x + MONTA * x * x + MONTB * x) % Fp, Fp);
  // Ensure returned value is the principal root (i.e. sqrt(x) ∈ [0, (Fp -1) / 2] )
  if (y2 > (Fp - BigInt(1)) / BigInt(2)) y2 = Fp - y2;
  const y = mulMod([-e, y2], Fp);
  return [x, y];
}

// required for SNARK where we don't calculate the square root rather prove that the square of two
// square roots is the number for constraint efficiency
export function hashToCurveYSqrt(r) {
  const v = modDivide(-MONTA, one + U * r * r, Fp);
  const e = chi((v * v * v + MONTA * v * v + MONTB * v) % Fp);
  const x = ((e * v) % Fp) - modDivide((one - e) * MONTA, BigInt(2), Fp);
  let y2 = squareRootModPrime((x * x * x + MONTA * x * x + MONTB * x) % Fp, Fp);
  // Ensure returned value is the principal root (i.e. sqrt(x) ∈ [0, (Fp -1) / 2] )
  if (y2 > (Fp - BigInt(1)) / BigInt(2)) y2 = Fp - y2;
  return y2;
}

// x=−A,
// if y=0 then x=0,and
// −ux(x+A) is a square in Fq.
function canCurveToHash(point) {
  const x = point[0];
  const y = point[1];
  if (x === BigInt(0)) {
    if (y !== BigInt(0)) {
      return false;
    }
  }
  return x !== -MONTA && isSquare(mulMod([mulMod([-U, x], Fp), addMod([x, MONTA], Fp)], Fp));
}

// r = sqrt(-x/(x+A)u), if y ∈ F2q
// r = sqrt(-(x+A)/ux), if y ∈/ F2q
export function curveToHash(point) {
  if (point[0] === BigInt(0) && point[1] === BigInt(0) && point.length === 2) return BigInt(0);
  if (!canCurveToHash(point)) throw new Error('cannot curve to hash');
  const x = point[0];
  const y = point[1];
  let r;
  if (isNegative(y)) {
    r = squareRootModPrime(modDivide(-(x + MONTA), U * x, Fp), Fp);
  } else {
    r = squareRootModPrime(modDivide(-x, U * (x + MONTA), Fp), Fp);
  }
  // Ensure returned value is the principal root (i.e. sqrt(x) ∈ [0, (Fp -1) / 2] )
  if (r > (Fp - BigInt(1)) / BigInt(2)) r = Fp - r;
  return r;
}
