/**
A commitment class
*/
import gen from 'general-number';
import sha256 from '../utils/crypto/sha256.mjs';
import { getLeafIndex } from '../utils/timber.mjs';

const { generalise } = gen;

class Commitment {
  preimage;

  hash;

  computedIndex; // this is the index of this commitment in the Merkle tree. unlike all other numbers in this class, it's a normal Number, rather than a GN for compaitibility with Timber.

  constructor({ zkpPublicKey, ercAddress, tokenId, value, salt }) {
    const properties = Object.values({ zkpPublicKey, ercAddress, tokenId, value, salt });
    for (const property of properties)
      if (property === undefined)
        throw new Error(
          `Property ${value} was undefined. Did you pass the wrong object to the constructor?`,
        );
    this.preimage = generalise({
      zkpPublicKey,
      ercAddress,
      tokenId,
      value,
      salt,
    });
    this.hash = sha256([
      this.preimage.ercAddress,
      this.preimage.tokenId,
      this.preimage.value,
      this.preimage.zkpPublicKey,
      this.preimage.salt,
    ]);
  }

  // note this is an async and returns a promise
  index() {
    if (!this.computedIndex === undefined)
      this.computedIndexindex = getLeafIndex(this.hash.hex(32));
    return this.computedIndex;
  }
}

export default Commitment;
