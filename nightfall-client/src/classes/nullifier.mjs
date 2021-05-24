/**
A nullifier class
*/
import gen from 'general-number';
import sha256 from '../utils/crypto/sha256.mjs';

const { generalise } = gen;

class Nullifier {
  preimage;

  hash;

  constructor(commitment, zkpPrivateKey) {
    this.preimage = generalise({
      zkpPrivateKey: zkpPrivateKey,
      salt: commitment.preimage.salt,
    });
    this.hash = sha256([this.preimage.zkpPrivateKey, this.preimage.salt]);
  }
}

export default Nullifier;
