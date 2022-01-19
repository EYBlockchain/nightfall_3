/* ignore unused exports */

import { GN, generalise } from 'general-number';
import { validateMnemonic, mnemonicToSeed } from 'bip39';
import pkg from 'ethereumjs-wallet';

import mimcHash from '../../common-files/utils/crypto/mimc/mimc';
import { scalarMult, edwardsCompress, edwardsDecompress } from '../utils/crypto/encryption/elgamal';

const { hdkey } = pkg;
export const ivks = [];
export const nsks = [];
const { BABYJUBJUB, BN128_GROUP_ORDER } = global.config;

function generateHexSeed(mnemonic) {
  return mnemonicToSeed(mnemonic);
}

// generate key from a seed based on path
function generatePrivateKey(seed, path) {
  return (
    new GN(hdkey.fromMasterSeed(seed).derivePath(path).getWallet().getPrivateKey()).bigInt %
    BN128_GROUP_ORDER
  );
}

function calculatePublicKey(privateKey) {
  return generalise(scalarMult(privateKey.hex(), BABYJUBJUB.GENERATOR));
}

export function compressPublicKey(publicKey) {
  return new GN(edwardsCompress([publicKey[0].bigInt, publicKey[1].bigInt]));
}

export function decompressKey(key) {
  return generalise(edwardsDecompress(key.bigInt));
}

// path structure is m / purpose' / coin_type' / account' / change / address_index
// the path we use is m/44'/60'/account'/0/address_index
// address will change incrementally for every new set of keys to be created from the same seed
// address_index will define if the key is ask or nsk
// path for ask is m/44'/60'/account'/0/0
// path for nsk is m/44'/60'/account'/0/1
async function generateASKAndNSK(seed, path) {
  const ask = generalise(generatePrivateKey(seed, `${path}/0`), 'bigInt');
  const nsk = generalise(generatePrivateKey(seed, `${path}/1`), 'bigInt');
  return { ask, nsk };
}

// Calculate ivk from ask and nsk such as ivk = MiMC(ask, nsk)
function calculateIVK(ask, nsk) {
  return new GN(mimcHash([ask.bigInt, nsk.bigInt]));
}

// Calculate pkd from ivk such as pkd = ivk.G
export function calculatePkd(ivk) {
  const pkd = calculatePublicKey(ivk);
  const compressedPkd = compressPublicKey(pkd);
  return { pkd, compressedPkd };
}

// function to generate all the required keys deterministically from a random mnemonic
// Use mnemonic to generate seed which will then be used to generate sets of ask and nsk based on different account numbers
export async function generateKeys(mnemonic, path) {
  if (validateMnemonic(mnemonic)) {
    const seed = (await generateHexSeed(mnemonic)).toString('hex');
    const { ask, nsk } = await generateASKAndNSK(seed, path);
    const ivk = calculateIVK(ask, nsk);
    const { pkd, compressedPkd } = calculatePkd(ivk);
    return {
      ask: ask.hex(),
      nsk: nsk.hex(),
      ivk: ivk.hex(),
      pkd: [pkd[0].hex(), pkd[1].hex()],
      compressedPkd: compressedPkd.hex(),
    };
  }
  throw new Error('invalid mnemonic');
}

export function storeMemoryKeysForDecryption(ivk, nsk) {
  return Promise.all([ivks.push(...ivk), nsks.push(...nsk)]);
}

export function calculateIvkPkdfromAskNsk(ask, nsk) {
  const ivk = calculateIVK(ask, nsk);
  const { pkd, compressedPkd } = calculatePkd(ivk);
  return { ivk, pkd, compressedPkd };
}
