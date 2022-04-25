/**
A nullifier class
*/
import gen from 'general-number';
import sha256 from 'common-files/utils/crypto/sha256.mjs';

const { generalise } = gen;

class Nullifier {
  preimage;

  hash;

  constructor(commitment, nsk) {
    this.preimage = generalise({
      nsk,
      commitment: commitment.hash,
    });
    // we truncate the hash down to 31 bytes but store it in a 32 byte variable
    // this is consistent to what we do in the ZKP circuits
    this.hash = generalise(sha256([this.preimage.nsk, this.preimage.commitment]).hex(32, 31));
  }
}

export default Nullifier;
