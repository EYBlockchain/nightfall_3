import { GN, generalise } from 'general-number';
import config from 'config';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import { mimcHash } from 'common-files/utils/crypto/mimc/mimc.mjs';
import { scalarMult, edwardsCompress } from '../utils/crypto/encryption/elgamal.mjs';

const { BABYJUBJUB, BN128_GROUP_ORDER } = config;

export function calculatePublicKey(privateKey) {
  return generalise(scalarMult(privateKey.hex(), BABYJUBJUB.GENERATOR));
}

export function compressPublicKey(publicKey) {
  return new GN(edwardsCompress([publicKey[0].bigInt, publicKey[1].bigInt]));
}

export async function generateASK(length) {
  const ask = new GN((await rand(length)).bigInt % BN128_GROUP_ORDER);
  return ask;
}

export async function generateNSK(length) {
  const nsk = new GN((await rand(length)).bigInt % BN128_GROUP_ORDER);
  return nsk;
}

export function calculateIVK(ask, nsk) {
  return new GN(mimcHash([ask.bigInt, nsk.bigInt]));
}

export function calculatePkd(ivk) {
  const pkd = calculatePublicKey(ivk);
  const compressedPkd = compressPublicKey(pkd);
  return { pkd, compressedPkd };
}

export function calculatePkdFromAskNsk(ask, nsk) {
  const ivk = calculateIVK(ask, nsk);
  return calculatePkd(ivk);
}

export function calculateIvkPkdfromAskNsk(ask, nsk) {
  const ivk = calculateIVK(ask, nsk);
  const { pkd, compressedPkd } = calculatePkd(ivk);
  return { ivk, pkd, compressedPkd };
}

// Randomly generate sk
// ask and nsk are random secret keys
// ivk = MiMC(ask, nsk)
// pkd = ivk.G

// function to generate all the required keys
export async function generateKeys(length) {
  const ask = await generateASK(length);
  const nsk = await generateNSK(length);
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
