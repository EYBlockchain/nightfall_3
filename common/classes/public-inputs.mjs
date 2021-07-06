/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved */

/**
Class to construct a public input hash (PIH).  Unlike a commitment, the PIH
will vary quite a bit and so we use an array as the input
*/
import gen from 'general-number';
import sha256 from '../../app/src/utils/crypto/sha256.mjs';

const { generalise } = gen;

class PublicInputs {
  publicInputs;

  hash;

  constructor(publicInputs) {
    this.publicInputs = generalise(publicInputs.flat(Infinity));
    [, this.hash] = generalise(sha256(this.publicInputs).limbs(248, 2));
  }
}

export default PublicInputs;
