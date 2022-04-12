/* eslint-disable import/no-extraneous-dependencies */
import { expect } from 'chai';
import * as fc from 'fast-check';
import BigFloat from '../../src/common-files/classes/bigFloat';

const numDecimals = 18; // Big Float handles any but this is useful for our testing.

const arbitraryStringOfNumbers = (minLength: number, maxLength: number): fc.Arbitrary<string> => {
  return fc.stringOf(fc.constantFrom('1', '2', '3', '4', '5', '6', '7', '8', '9', '0'), {
    minLength,
    maxLength,
  });
};

describe('BigFloat tests', () => {
  describe('Basic unit tests', () => {
    it('Should correctly construct small floats', () => {
      const float = 1.01;
      const bigFloat: BigFloat = new BigFloat(float, 2);
      expect(bigFloat.toString()).to.equal(float.toString());
    });
    it('Should correctly construct big floats', () => {
      // Float Test is 18446744073709552000.012345678987654321
      // Significand > 2**64 and mantissa length === 18
      const significand = '18446744073709552000';
      const mantissa = '012345678987654321';
      const bigintFloat = BigInt(`${significand}${mantissa}`);
      const bigFloat: BigFloat = new BigFloat(bigintFloat, 18);
      expect(bigFloat.toString()).to.equal(`${significand}.${mantissa}`);
    });
    it('Should add on big floats', () => {
      const significand = '18446744073709552000';
      const mantissa = '012345678987654321';
      const bigFloat = new BigFloat(`${significand}.${mantissa}`, 18);
      const operand = 0.01;
      expect(bigFloat.add(operand).toString()).to.equal(`${significand}.022345678987654321`);
    });
    it('Should multiply on big floats', () => {
      const significand = '18446744073709552000';
      const mantissa = '012345678987654321';
      const bigFloat = new BigFloat(`${significand}.${mantissa}`, 18);
      const operand = 0.01;
      // We pick 0.01 so we just need to scale the initial values;
      const updatedSignificand = significand.slice(0, -2);
      // We slice two from the mantissa as we have to maintain set precision.
      const updatedMantissa = `00${mantissa.slice(0, -2)}`;
      expect(bigFloat.mul(operand).toString()).to.equal(`${updatedSignificand}.${updatedMantissa}`);
    });
  });

  describe('Testing Idempotent Construction', () => {
    it('Check construction from float', () => {
      fc.assert(
        fc.property(
          fc.double({ next: true, min: 0, max: 1, noDefaultInfinity: true, noNaN: true }),
          doubleFloat => {
            const bigFloat = new BigFloat(doubleFloat, numDecimals);
            expect(bigFloat.toFixed(numDecimals)).to.equal(doubleFloat.toFixed(numDecimals));
          },
        ),
      );
    });
    it('Check construction from integer', () => {
      fc.assert(
        fc.property(fc.nat(), int => {
          const bigFloat = new BigFloat(int, numDecimals);
          expect(bigFloat.toFixed(numDecimals)).to.equal(int.toFixed(numDecimals));
        }),
      );
    });
    it('Check construction from string', () => {
      fc.assert(
        fc.property(
          arbitraryStringOfNumbers(1, 30),
          arbitraryStringOfNumbers(numDecimals, numDecimals),
          (significand, mantissa) => {
            const bigFloat = new BigFloat(`${significand}.${mantissa}`, numDecimals);
            expect(bigFloat.toString()).to.equal(`${significand}.${mantissa}`);
          },
        ),
      );
    });
  });

  describe('Test basic arithmetic operations', () => {
    it('Should add correctly', () => {
      fc.assert(
        fc.property(
          arbitraryStringOfNumbers(1, 5),
          arbitraryStringOfNumbers(9, 9),
          fc.double({ next: true, min: 0.1, max: 100000, noDefaultInfinity: true, noNaN: true }),
          (significand, mantissa, operand) => {
            const roundOperand = Number(operand.toFixed(9));
            const bigFloat = new BigFloat(`${significand}.${mantissa}`, 9);
            const bigOperand = new BigFloat(operand.toString(), 9);
            const result = Number(`${significand}.${mantissa}`) + roundOperand;
            // Checking float operations is a pain...
            expect(Number(bigFloat.add(bigOperand).toFixed(9))).closeTo(
              Number(result.toFixed(9)),
              0.000000002,
            );
          },
        ),
      );
    });
    it('Should multiply correctly', () => {
      fc.assert(
        fc.property(
          arbitraryStringOfNumbers(1, 5),
          arbitraryStringOfNumbers(9, 9),
          fc.double({ next: true, min: 0.1, max: 100000, noDefaultInfinity: true, noNaN: true }),
          (significand, mantissa, operand) => {
            const roundOperand = Number(operand.toFixed(9));
            const bigFloat = new BigFloat(`${significand}.${mantissa}`, 9);
            const bigOperand = new BigFloat(operand.toString(), 9);
            const result = Number(`${significand}.${mantissa}`) * roundOperand;
            // Checking float operations is a pain...
            expect(Number(bigFloat.mul(bigOperand).toFixed(9))).closeTo(
              Number(result.toFixed(9)),
              0.0001,
            );
          },
        ),
      );
    });
  });
});
