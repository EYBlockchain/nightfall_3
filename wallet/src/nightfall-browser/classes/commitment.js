// ignore unused exports default

/**
A commitment class
*/
import gen from 'general-number';
import sha256 from '../../common-files/utils/crypto/sha256';

const { generalise } = gen;

class Commitment {
  preimage;

  hash;

  isNullified = false;

  isNullifiedOnChain = -1;

  constructor({ ercAddress, tokenId, value, pkd = [], compressedPkd, salt }) {
    const items = { ercAddress, tokenId, value, pkd, compressedPkd, salt };
    const keys = Object.keys(items);
    for (const key of keys)
      if (items[key] === undefined)
        throw new Error(
          `Property ${key} was undefined. Did you pass the wrong object to the constructor?`,
        );
    this.preimage = generalise({
      ercAddress,
      tokenId,
      value,
      pkd,
      compressedPkd,
      salt,
    });
    this.hash = generalise(sha256([
      this.preimage.ercAddress,
      this.preimage.tokenId,
      this.preimage.value,
      this.preimage.compressedPkd,
      this.preimage.salt,
    ]).hex(32, 31));
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
