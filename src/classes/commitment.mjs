/**
A commitment class
*/
import gen from 'general-number';
import sha256 from '../utils/crypto/sha256.mjs';

const { generalise } = gen;

class Commitment {
  preImage;

  hash;

  constructor({ zkpPublicKey, ercAddress, tokenId, value, salt }) {
    this.preImage = generalise({
      zkpPublicKey,
      ercAddress,
      tokenId,
      value,
      salt,
    });
    this.hash = sha256([
      this.preImage.ercAddress,
      this.preImage.tokenId,
      this.preImage.value,
      this.preImage.zkpPublicKey,
      this.preImage.salt,
    ]);
  }
}

export default Commitment;
