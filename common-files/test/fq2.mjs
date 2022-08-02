import assert from 'assert';
import Fq2 from 'common-files/classes/fq2.mjs';

// use the base point x ordinate as a test element
const fq2 = new Fq2(
  11559732032986387107991004021392285783925812861821192530917403151452391805634n,
  10857046999023057135944570762232829481370756359578518086990519993285655852781n,
);

describe('Arithmetic tests in F_q^2', () => {
  it('Should correctly add two numbers', () => {
    const test = new Fq2(
      1231221194133498993735602297527296479155314566344561399145768408259557402685n,
      21714093998046114271889141524465658962741512719157036173981039986571311705562n,
    );
    const sum = fq2.add(fq2);
    assert.ok(test.equals(sum));
  });
  it('Should correctly multiply two numbers', () => {
    const test = new Fq2(
      147262482912369164819512749136852740079321528442661765006066873953128248302n,
      1837384903404616869280368109057824469904033017901941306968221631236329083166n,
    );
    const mul = fq2.mul(fq2);
    assert.ok(test.equals(mul));
  });
  it('Should correctly divide two numbers', () => {
    const test = fq2.mul(fq2).div(fq2);
    assert.ok(test.equals(fq2));
  });
  it('Should correctly compute the a number raised to a power', () => {
    const test = fq2.mul(fq2).mul(fq2).mul(fq2).mul(fq2).mul(fq2);
    const pow = fq2.pow(6n);
    assert.ok(test.equals(pow));
  });
  it('Should correctly compute the square root of a number', () => {
    const test = fq2.mul(fq2);
    const sqrt = test.sqrt();
    assert.ok(test.equals(sqrt.mul(sqrt)));
  });
});
