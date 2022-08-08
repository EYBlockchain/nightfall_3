/* ignore unused exports */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GN, generalise, GeneralNumber } from 'general-number';
import { validateMnemonic, mnemonicToSeedSync } from 'bip39';
import { hdkey } from 'ethereumjs-wallet';

import poseidon from '../../common-files/utils/crypto/poseidon/poseidon';
import {
  scalarMult,
  edwardsCompress,
  edwardsDecompress,
} from '../../common-files/utils/curve-maths/curves';

export const zkpPrivateKeys: any = [];
export const nullifierKeys: any = [];
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { BABYJUBJUB, BN128_GROUP_ORDER } = global.config;

export class ZkpKeys {
  rootKey;

  zkpPrivateKey;

  nullifierKey;

  zkpPublicKey;

  compressedZkpPublicKey;

  constructor(rootKey: GeneralNumber) {
    this.rootKey = rootKey;
    this.zkpPrivateKey = poseidon([
      rootKey,
      new GN(2708019456231621178814538244712057499818649907582893776052749473028258908910n),
    ]);
    this.nullifierKey = poseidon([
      rootKey,
      new GN(7805187439118198468809896822299973897593108379494079213870562208229492109015n),
    ]);
    const scalarResult: string[] = scalarMult(this.zkpPrivateKey.hex(32), BABYJUBJUB.GENERATOR);
    this.zkpPublicKey = generalise(scalarResult);
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
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  static generateZkpKeysFromMnemonic(mnemonic: string, addressIndex: number) {
    if (validateMnemonic(mnemonic)) {
      const seed = mnemonicToSeedSync(mnemonic);
      const rootKey = generalise(
        new GN(
          hdkey
            .fromMasterSeed(seed)
            .derivePath(`m/44'/60'/0'/0/${addressIndex}`)
            .getWallet()
            .getPrivateKey(),
        ).bigInt % BN128_GROUP_ORDER,
      );
      const zkpPrivateKey = poseidon([
        rootKey,
        new GN(2708019456231621178814538244712057499818649907582893776052749473028258908910n),
      ]);
      const nullifierKey = poseidon([
        rootKey,
        new GN(7805187439118198468809896822299973897593108379494079213870562208229492109015n),
      ]);
      const scalarResult: string[] = scalarMult(zkpPrivateKey.hex(32), BABYJUBJUB.GENERATOR);
      const zkpPublicKey = generalise(scalarResult);
      const compressedZkpPublicKey = new GN(
        edwardsCompress([zkpPublicKey[0].bigInt, zkpPublicKey[1].bigInt]),
      );
      return {
        rootKey: generalise(rootKey.field(BN128_GROUP_ORDER)).hex(32),
        zkpPrivateKey: zkpPrivateKey.hex(32),
        nullifierKey: nullifierKey.hex(32),
        zkpPublicKey: [zkpPublicKey[0].hex(32), zkpPublicKey[1].hex(32)],
        compressedZkpPublicKey: compressedZkpPublicKey.hex(),
      };
    }
    throw new Error('invalid mnemonic');
  }

  static calculateZkpPublicKey(zkpPrivateKey: GeneralNumber): {
    zkpPublicKey: GeneralNumber[];
    compressedZkpPublicKey: GeneralNumber;
  } {
    const scalarResult: string[] = scalarMult(zkpPrivateKey.hex(32), BABYJUBJUB.GENERATOR);
    const zkpPublicKey = generalise(scalarResult);
    const compressedZkpPublicKey = new GN(
      edwardsCompress([zkpPublicKey[0].bigInt, zkpPublicKey[1].bigInt]),
    );
    return { zkpPublicKey, compressedZkpPublicKey };
  }

  static decompressZkpPublicKey(compressedZkpPublicKey: GeneralNumber): GeneralNumber[] {
    const decompressedPoint: string[] = edwardsDecompress(compressedZkpPublicKey.bigInt);
    return generalise(decompressedPoint);
  }

  static compressZkpPublicKey(zkpPublicKey: GeneralNumber[]): GeneralNumber {
    return new GN(edwardsCompress([zkpPublicKey[0].bigInt, zkpPublicKey[1].bigInt]));
  }
}
