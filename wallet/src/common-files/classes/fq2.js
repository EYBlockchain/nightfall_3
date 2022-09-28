/**
Class representing a complex modular number.  In particular, this is useful
for dealing with f_q^2 field elements in the alt BN128 curve.
*/
import gen from 'general-number';
import { modDivide, complexDivMod } from '../utils/crypto/modular-division';

const { generalise } = gen;

const { BN128_PRIME_FIELD } = global.nightfallConstants;

class Fq2 {
  m = BN128_PRIME_FIELD;

  x;

  y;

  constructor(x, y, m = BN128_PRIME_FIELD) {
    this.x = BigInt(x);
    this.y = BigInt(y);
    this.m = BigInt(m);
  }

  toHex() {
    return generalise([this.x, this.y]).all.hex(32);
  }

  get real() {
    return this.x;
  }

  get imaginary() {
    return this.y;
  }

  mod(x, q = this.m) {
    return ((x % q) + q) % q; // accounts for x being negative
  }

  add(b) {
    return new Fq2(this.mod(this.x + b.real), this.mod(this.y + b.imaginary));
  }

  mul(b) {
    return new Fq2(
      this.mod(this.x * b.real - this.y * b.imaginary),
      this.mod(this.y * b.real + this.x * b.imaginary),
    );
  }

  div(b) {
    const [x, y] = complexDivMod([this.x, this.y], [b.x, b.y], this.m);
    return new Fq2(x, y);
  }

  // The exponent must be real.
  pow(exponent) {
    if (this.m === 1n) return new Fq2(0, 0);
    let result = new Fq2(1, 0);
    let b = new Fq2(this.x, this.y); // don't mutate ourself
    let e = BigInt(exponent);
    while (e > 0n) {
      if (e % 2n === 1n) result = result.mul(b);
      e >>= 1n; // eslint-disable-line no-bitwise
      b = b.mul(b);
    }
    return result;
  }

  equals(b) {
    return b.real === this.x && b.imaginary === this.y;
  }

  sqrt() {
    // This method is from https://eprint.iacr.org/2012/685.pdf.  We gratefully
    // acknowledge the contribution from these authors.
    // step 0.  Ensure that q meets the condition q = 3 mod 4
    if (this.mod(this.m, 4n) !== 3n) throw new Error('Field is not congruent to 3 mod 4');
    // step 1
    const a1 = this.pow(modDivide(this.m - 3n, 4n));
    // step 2
    const alpha = a1.mul(this).mul(a1);
    // step 3
    const a0 = alpha.pow(this.m).mul(alpha);
    // steps 4, 5, 6
    if (a0.equals(new Fq2(this.m - 1n, 0n))) return null; // sqrt does not exist.
    // step 7
    const x0 = a1.mul(this);
    // step 8
    let x;
    if (alpha.equals(new Fq2(this.m - 1n, 0n))) x = new Fq2(0n, 1n).mul(x0);
    // steps 10, 11, 12
    else {
      const b = new Fq2(1n, 0n).add(alpha).pow(modDivide(this.m - 1n, 2n));
      x = b.mul(x0);
    }
    return x;
  }
}

export default Fq2;
