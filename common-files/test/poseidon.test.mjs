/*
Test vectors for the Poseidon hash (with thanks to Iden3 for creating them)
*/
import assert from 'assert';
import gen from 'general-number';
import poseidon from '../utils/crypto/poseidon/poseidon.mjs';

const { generalise } = gen;

describe('Poseidon hash tests', function () {
  it('Should correctly hash [1,2,0,0,0]', function () {
    assert.equal(
      poseidon(generalise([1, 2, 0, 0, 0])).bigInt,
      BigInt('1018317224307729531995786483840663576608797660851238720571059489595066344487'),
    );
  });
  it('Should correctly hash [1,2]', function () {
    assert.equal(
      poseidon(generalise([1, 2])).bigInt,
      BigInt('7853200120776062878684798364095072458815029376092732009249414926327459813530'),
    );
  });
  it('Should correctly hash [3,4,5,10,23]', function () {
    assert.equal(
      poseidon(generalise([3, 4, 5, 10, 23])).bigInt,
      BigInt('13034429309846638789535561449942021891039729847501137143363028890275222221409'),
    );
  });
  it('Should correctly hash [3,4]', function () {
    assert.equal(
      poseidon(generalise([3, 4])).bigInt,
      BigInt('14763215145315200506921711489642608356394854266165572616578112107564877678998'),
    );
  });
});
