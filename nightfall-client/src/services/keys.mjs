import { GN, generalise } from 'general-number';
import poseidon from 'common-files/utils/crypto/poseidon/poseidon.mjs';
import bip39Pkg from 'bip39';
import pkg from 'ethereumjs-wallet';
import {
  scalarMult,
  edwardsCompress,
  edwardsDecompress,
} from 'common-files/utils/curve-maths/curves.mjs';
import constants from 'common-files/constants/index.mjs';

const { hdkey } = pkg;
const { validateMnemonic, mnemonicToSeedSync } = bip39Pkg;
export const zkpPrivateKeys = [];
export const nullifierKeys = [];
const { BABYJUBJUB, BN128_GROUP_ORDER } = constants;

// 128 bits is 12 words; 256 bits is 24 words
// // Returns a promise
// function (entropyBits) {
//   return generateMnemonic(entropyBits);
// }
//
// // generate seed from mnemonic
// function (mnemonic) {
//   return mnemonicToSeedSync(mnemonic);
// }

export class ZkpKeys {
  rootKey;

  zkpPrivateKey;

  nullifierKey;

  zkpPublicKey;

  compressedZkpPublicKey;

  constructor(rootKey) {
    this.rootKey = rootKey;
    this.zkpPrivateKey = poseidon([
      rootKey,
      new GN(2708019456231621178814538244712057499818649907582893776052749473028258908910n),
    ]);
    this.nullifierKey = poseidon([
      rootKey,
      new GN(7805187439118198468809896822299973897593108379494079213870562208229492109015n),
    ]);
    this.zkpPublicKey = generalise(scalarMult(this.zkpPrivateKey.hex(), BABYJUBJUB.GENERATOR));
    this.compressedZkpPublicKey = new GN(
      edwardsCompress([this.zkpPublicKey[0].bigInt, this.zkpPublicKey[1].bigInt]),
    );
  }

  // path structure is m / purpose' / coin_type' / account' / change / address_index
  // the path we use is m/44'/60'/account'/0/address_index. 44' is hardened. 60 is Ether.
  // change is 0 when external and 1 when internal. External when the public keys will be communicated externally for use
  // account will remain 0 and multiple addresses will be created for these keys by incrementing address_index
  // path for zkpPrivateKey is m/44'/60'/account'/0/addressIndex

  // function to generate all the required keys deterministically from a random mnemonic
  // Use mnemonic to generate seed which will then be used to generate sets of zkpPrivateKey and nullifierKey based on different account numbers
  // The domain numbers are derived thusly:
  // keccak256('zkpPrivateKey') % BN128_GROUP_ORDER 2708019456231621178814538244712057499818649907582893776052749473028258908910
  // keccak256('nullifierKey') % BN128_GROUP_ORDER 7805187439118198468809896822299973897593108379494079213870562208229492109015
  static generateZkpKeysFromMnemonic(mnemonic, addressIndex) {
    if (validateMnemonic(mnemonic)) {
      const seed = mnemonicToSeedSync(mnemonic).toString('hex');
      const rootKey = generalise(
        new GN(
          hdkey
            .fromMasterSeed(seed)
            .derivePath(`m/44'/60'/0'/0/${addressIndex}`)
            .getWallet()
            .getPrivateKey(),
        ).bigInt % BN128_GROUP_ORDER,
        'bigInt',
      );
      const zkpPrivateKey = poseidon([
        rootKey,
        new GN(2708019456231621178814538244712057499818649907582893776052749473028258908910n),
      ]);
      const nullifierKey = poseidon([
        rootKey,
        new GN(7805187439118198468809896822299973897593108379494079213870562208229492109015n),
      ]);
      const zkpPublicKey = generalise(scalarMult(zkpPrivateKey.hex(), BABYJUBJUB.GENERATOR));
      const compressedZkpPublicKey = new GN(
        edwardsCompress([zkpPublicKey[0].bigInt, zkpPublicKey[1].bigInt]),
      );
      return {
        rootKey: rootKey.hex(),
        zkpPrivateKey: zkpPrivateKey.hex(),
        nullifierKey: nullifierKey.hex(),
        zkpPublicKey: [zkpPublicKey[0].hex(), zkpPublicKey[1].hex()],
        compressedZkpPublicKey: compressedZkpPublicKey.hex(),
      };
    }
    throw new Error('invalid mnemonic');
  }

  static calculateZkpPublicKey(zkpPrivateKey) {
    const zkpPublicKey = generalise(scalarMult(zkpPrivateKey.hex(), BABYJUBJUB.GENERATOR));
    const compressedZkpPublicKey = new GN(
      edwardsCompress([zkpPublicKey[0].bigInt, zkpPublicKey[1].bigInt]),
    );
    return { zkpPublicKey, compressedZkpPublicKey };
  }

  static decompressZkpPublicKey(compressedZkpPublicKey) {
    return generalise(edwardsDecompress(compressedZkpPublicKey.bigInt));
  }

  static compressZkpPublicKey(zkpPublicKey) {
    return new GN(edwardsCompress([zkpPublicKey[0].bigInt, zkpPublicKey[1].bigInt]));
  }
}

export function storeMemoryKeysForDecryption(zkpPrivateKey, nullifierKey) {
  return Promise.all([
    zkpPrivateKeys.includes(zkpPrivateKey[0])
      ? zkpPrivateKeys
      : zkpPrivateKeys.push(...zkpPrivateKey),
    nullifierKeys.includes(nullifierKey[0]) ? nullifierKey : nullifierKeys.push(...nullifierKey),
  ]);
}
