// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'chai';
import BigFloat from '../../src/common-files/classes/bigFloat';

describe('BigFloat tests', () => {
  it('Check small floats', () => {
    const float = 1.01;
    const bigFloat: BigFloat = new BigFloat(float, 2);
    expect(bigFloat.toString()).to.equal(float.toString());
  });
  it('Check big floats', () => {
    // Float Test is 18446744073709552000.012345678987654321
    // Significand > 2**64 and mantissa length === 18
    const significand = '18446744073709552000';
    const mantissa = '012345678987654321';
    const bigintFloat = BigInt(`${significand}${mantissa}`);
    const bigFloat: BigFloat = new BigFloat(bigintFloat, 18);
    expect(bigFloat.toString()).to.equal(`${significand}.${mantissa}`);
  });
  it('Do operations on big floats', () => {
    const significand = '18446744073709552000';
    const mantissa = '012345678987654321';
    const bigFloat = new BigFloat(`${significand}.${mantissa}`, 18);
    const operand = 0.01;
    expect(bigFloat.add(operand).toString()).to.equal(`${significand}.022345678987654321`);
  });
});
