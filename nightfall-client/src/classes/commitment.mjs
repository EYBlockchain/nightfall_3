/**
A commitment class
*/
import gen from 'general-number';
import config from 'config';
import poseidon from 'common-files/utils/crypto/poseidon/poseidon.mjs';

const { generalise } = gen;
const { BN128_GROUP_ORDER } = config;

class Commitment {
  preimage;

  hash;

  isNullified = false;

  isNullifiedOnChain = -1;

  constructor({ ercAddress, tokenId, value, pkd = [], salt }) {
    const items = { ercAddress, tokenId, value, pkd, salt };
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
      salt,
    });
    // we truncate the hash down to 31 bytes but store it in a 32 byte variable
    // this is consistent to what we do in the ZKP circuits
    const [top4Bytes, remainder] = tokenId.limbs(160, 2).map(l => BigInt(l));
    const SHIFT = 2923003274661805836407369665432566039311865085952n;
    this.hash = poseidon(
      generalise([
        this.preimage.ercAddress.bigInt + top4Bytes * SHIFT,
        remainder,
        this.preimage.value.field(BN128_GROUP_ORDER),
        this.preimage.pkd[0].field(BN128_GROUP_ORDER),
        this.preimage.pkd[1].field(BN128_GROUP_ORDER),
        this.preimage.salt.field(BN128_GROUP_ORDER),
      ]),
    );
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
