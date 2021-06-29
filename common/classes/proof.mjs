/* eslint-disable import/no-extraneous-dependencies */

/**
Class representing a GM17 proof.  Depending on the local definition of 'proof',
an object from this class may contain the public inputs as well as the a, b, c
terms.  Verifier.sol expects the public inputs to be separate, zokrates verify
expects them to be in the same object.  This class can accomodate either.
@param proof - a flattened proof array (such as one might send to a shield contract.
*/
import gen from 'general-number';

const { generalise } = gen;

class Proof {
  constructor(proof) {
    this.a = generalise([proof[0], proof[1]]).all.hex(32);
    this.b = generalise([
      [proof[2], proof[3]],
      [proof[4], proof[5]],
    ]).all.hex(32);
    this.c = generalise([proof[6], proof[7]]).all.hex(32);
  }

  // note -  a flattened proof, such as is used by verifier.sol does not contain
  // any public inputs
  get flattened() {
    return [this.a, this.b, this.c].flat(Infinity);
  }
}

export default Proof;
