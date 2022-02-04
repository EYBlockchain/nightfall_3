/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
Class to construct a public input hash (PIH).  Unlike a commitment, the PIH
will vary quite a bit and so we use an array as the input
*/
import gen from 'general-number';
import sha256 from '../utils/crypto/sha256.mjs';

const { generalise } = gen;

class PublicInputs {
  publicInputs;

  hash;

  constructor(publicInputs) {
    // some inputs may be general numbers and some strings.  We convert all to string, process and generalise.
    this.publicInputs = generalise(publicInputs.flat(Infinity));
    [, this.hash] = generalise(sha256(this.publicInputs).limbs(248, 2));
  }
}

export default PublicInputs;
