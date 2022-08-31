// ignore unused exports default
/**
A nullifier class
*/
import gen from 'general-number';
import poseidon from '../../common-files/utils/crypto/poseidon/poseidon';

const { generalise } = gen;

class Nullifier {
  preimage;

  hash;

  constructor(commitment, nullifierKey) {
    this.preimage = generalise({
      nullifierKey,
      commitment: commitment.hash,
    });
    this.hash = poseidon([this.preimage.nullifierKey, this.preimage.commitment]);
  }
}

export default Nullifier;
