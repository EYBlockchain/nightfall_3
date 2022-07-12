/**
A nullifier class
*/
import gen from 'general-number';
import poseidon from 'common-files/utils/crypto/poseidon/poseidon.mjs';

const { generalise } = gen;

class Nullifier {
  preimage;

  hash;

  constructor(commitment, nsk) {
    this.preimage = generalise({
      nsk,
      commitment: commitment.hash,
    });
    this.hash = poseidon([this.preimage.nsk, this.preimage.commitment]);
  }
}

export default Nullifier;
