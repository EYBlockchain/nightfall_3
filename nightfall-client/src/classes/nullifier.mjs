/**
A nullifier class
*/
import gen from 'general-number';
import poseidon from 'common-files/utils/crypto/poseidon/poseidon.mjs';

const { generalise } = gen;

class Nullifier {
  preimage;

  hash;

  constructor(commitment, nullifierKey) {
    // make sure the preimage contains a General-Number type nullifier key
    this.preimage = {
      nullifierKey: nullifierKey?.bigInt ? nullifierKey : generalise(nullifierKey),
      commitment: commitment.hash,
    };
    this.hash = poseidon([this.preimage.nullifierKey, this.preimage.commitment]);
  }
}

export default Nullifier;
