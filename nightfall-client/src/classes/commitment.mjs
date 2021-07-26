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

  isOnChain = -1;

  isNullified = false;

  isNullifiedOnChain = -1;

  #computedIndex; // this is the index of this commitment in the Merkle tree. unlike all other numbers in this class, it's a normal Number, rather than a GN for compaitibility with Timber.

  constructor({ zkpPublicKey, ercAddress, tokenId, value, salt }) {
    const items = { zkpPublicKey, ercAddress, tokenId, value, salt };
    const keys = Object.keys(items);
    for (const key of keys)
      if (items[key] === undefined)
        throw new Error(
          `Property ${key} was undefined. Did you pass the wrong object to the constructor?`,
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
  get index() {
    if (this.#computedIndex === undefined) this.#computedIndex = getLeafIndex(this.hash.hex(32));
    return this.#computedIndex;
  }

  // sometimes (e.g. going over http) the general-number class is inconvenient
  toHex() {
    return {
      preimage: this.preimage.all.hex(),
      hash: this.hash.hex(),
    };
  }
}

export default Commitment;
