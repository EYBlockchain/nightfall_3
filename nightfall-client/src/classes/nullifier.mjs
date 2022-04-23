/**
A nullifier class
*/
import gen from 'general-number';
import sha256 from 'common-files/utils/crypto/sha256.mjs';

const { generalise, GN } = gen;

class Nullifier {
  preimage;

  hash;

  constructor(commitment, nsk) {
    this.preimage = generalise({
      nsk,
      commitment: commitment.hash,
    });
    // truncate the hash so that the nullifier fits inside a BN128 group order.
    this.hash = new GN(sha256([this.preimage.nsk, this.preimage.commitment]).hex(32, 31));
  }
}

export default Nullifier;
