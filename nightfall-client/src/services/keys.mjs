/* eslint-disable no-await-in-loop */
import { GN, generalise } from 'general-number';
import poseidon from 'common-files/utils/crypto/poseidon/poseidon.mjs';
import bip39Pkg from 'bip39';
import pkg from 'ethereumjs-wallet';
import fs from 'fs';
import {
  scalarMult,
  edwardsCompress,
  edwardsDecompress,
} from 'common-files/utils/curve-maths/curves.mjs';
import constants from 'common-files/constants/index.mjs';
import logger from 'common-files/utils/logger.mjs';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { v4 as uuidv4 } from 'uuid';

const { hdkey } = pkg;
const { validateMnemonic, mnemonicToSeedSync } = bip39Pkg;
export const zkpPrivateKeys = [];
export const nullifierKeys = [];
const { BABYJUBJUB, BN128_GROUP_ORDER } = constants;
const KEY_BACKUP_FILE_PATH = '/app/keys';

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

async function isValidPath(filename) {
  try {
    await fs.promises.access(filename);
    return true;
  } catch (error) {
    logger.error(error, 'Non-Fatal Error');
    return false;
  }
}

export async function addKeysToPersistence(_zkpPrivateKeys, _nullifierKeys) {
  const stringifiedZkpPrivateKeys = _zkpPrivateKeys.map(zkpPrivateKey => zkpPrivateKey.toString());
  const stringifiedNullifierKeys = _nullifierKeys.map(nullifierKey => nullifierKey.toString());

  const fileName = `${uuidv4()}.json`;

  await fs.promises.writeFile(
    path.join(KEY_BACKUP_FILE_PATH, fileName),
    JSON.stringify([stringifiedZkpPrivateKeys, stringifiedNullifierKeys]),
  );
}

export async function storeMemoryKeysForDecryption(
  _zkpPrivateKeys,
  _nullifierKeys,
  persist = true,
) {
  if (!zkpPrivateKeys.includes(_zkpPrivateKeys[0])) {
    zkpPrivateKeys.push(..._zkpPrivateKeys);
  }

  if (!nullifierKeys.includes(_nullifierKeys[0])) {
    nullifierKeys.push(..._nullifierKeys);
  }

  if (persist) {
    await addKeysToPersistence(_zkpPrivateKeys, _nullifierKeys);
  }
}

/**
 * This method is intended to "restore" any viewing keys that are lost during a restart of the client.
 */
export async function loadKeysFromPersistence() {
  if (await isValidPath(KEY_BACKUP_FILE_PATH)) {
    const allFiles = await fs.promises.readdir(KEY_BACKUP_FILE_PATH);

    const jsonFiles = allFiles.filter(file => path.extname(file) === '.json');

    for (const file of jsonFiles) {
      logger.info(`Restoring keys from ${file}`);
      const fileContent = await fs.promises.readFile(
        path.join(KEY_BACKUP_FILE_PATH, file),
        'utf-8',
      );
      const parsedFileContent = JSON.parse(fileContent);

      const _zkpPrivateKeys = parsedFileContent[0].map(zkpPrivateKey => BigInt(zkpPrivateKey));
      const _nullifierKeys = parsedFileContent[1].map(nullifierKey => BigInt(nullifierKey));

      await storeMemoryKeysForDecryption(_zkpPrivateKeys, _nullifierKeys, false);
    }
  }
}

export function getCurrentKeys() {
  return {
    zkpPrivateKeys,
    nullifierKeys,
  };
}
