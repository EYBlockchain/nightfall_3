// ignore unused exports default

/**
A nullifier class
*/
import gen from 'general-number';
import sha256 from '../../common-files/utils/crypto/sha256';

const { generalise, GN } = gen;

class Nullifier {
  preimage;

  hash;

  constructor(commitment, nsk) {
    this.preimage = generalise({
      nsk,
      commitment: commitment.hash,
    });
    this.hash = new GN(sha256([this.preimage.nsk, this.preimage.commitment]).hex(31));
  }
}

export default Nullifier;
