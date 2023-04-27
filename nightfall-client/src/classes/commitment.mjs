/**
A commitment class
*/
import gen from 'general-number';
import poseidon from 'common-files/utils/crypto/poseidon/poseidon.mjs';
import constants from 'common-files/constants/index.mjs';
import { ZkpKeys } from '../services/keys.mjs';

const { generalise } = gen;
const { BN128_GROUP_ORDER, SHIFT } = constants;

class Commitment {
  preimage;

  hash;

  isNullified = false;

  isNullifiedOnChain = -1;

  constructor({ ercAddress, tokenId, value, zkpPublicKey, salt }) {
    const items = { ercAddress, tokenId, value, zkpPublicKey, salt };
    const keys = Object.keys(items);
    for (const key of keys)
      if (items[key] === undefined)
        throw new Error(
          `Property ${key} was undefined. Did you pass the wrong object to the constructor?`,
        );

    // the compressedPkd is not part of the pre-image but it's used widely in the rest of
    // the code, so we hold it in the commitment object (but not as part of the preimage)
    this.preimage = generalise(items);
    this.compressedZkpPublicKey =
      this.preimage.zkpPublicKey[0] === 0
        ? [0, 0]
        : ZkpKeys.compressZkpPublicKey(this.preimage.zkpPublicKey);
    // we encode the top four bytes of the tokenId into the empty bytes at the top of the erc address.
    // this is consistent to what we do in the ZKP circuits
    const [top4Bytes, remainder] = this.preimage.tokenId.limbs(224, 2).map(l => BigInt(l));
    const packedErcAddress = this.preimage.ercAddress.bigInt + top4Bytes * SHIFT;
    this.hash = poseidon(
      generalise([
        packedErcAddress,
        remainder,
        this.preimage.value.field(BN128_GROUP_ORDER),
        ...this.preimage.zkpPublicKey.all.field(BN128_GROUP_ORDER),
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
