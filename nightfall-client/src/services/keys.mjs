import { GN, generalise } from 'general-number';
import { BABYJUBJUB } from 'config';
import { scalarMult, edwardsCompress } from '../utils/crypto/encryption/elgamal.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import { mimcHash } from '../utils/crypto/mimc/mimc.mjs';

export async function calculatePublicKey(privateKey) {
  return generalise(scalarMult(privateKey.hex(), BABYJUBJUB.GENERATOR));
}

export async function compressPublicKey(publicKey) {
  return new GN(edwardsCompress([publicKey[0].bigInt, publicKey[1].bigInt]));
}

export async function generateSK(length) {
  return rand(length);
}

async function calculateASK(sk) {
  return new GN(mimcHash([sk.bigInt, BigInt(0)]));
}

async function calculateNSK(sk) {
  return new GN(mimcHash([sk.bigInt, BigInt(1)]));
}

export async function calculateIVK(ask, nsk) {
  return new GN(mimcHash([ask.bigInt, nsk.bigInt]));
}

export async function calculatePkd(ivk) {
  const pkd = await calculatePublicKey(ivk);
  const compressedPkd = await compressPublicKey(pkd);
  return { pkd, compressedPkd };
}

export async function calculatePkdFromAskNsk(ask, nsk) {
  const ivk = await calculateIVK(ask, nsk);
  return calculatePkd(ivk);
}

// Randomly generate SK
// NSK = Hash(SK||0)
// ASK = Hash(SK||1)
// IVK = Hash(ASK, NSK)
// Pkd = IVK .  Gd

// function to generate all the required keys
export async function generateKeys(length) {
  const sk = await generateSK(length);
  const ask = await calculateASK(sk);
  const nsk = await calculateNSK(sk);
  const ivk = await calculateIVK(ask, nsk);
  const { pkd, compressedPkd } = await calculatePkd(ivk);
  return {
    sk: sk.hex(),
    ask: ask.hex(),
    nsk: nsk.hex(),
    ivk: ivk.hex(),
    pkd: [pkd[0].hex(), pkd[1].hex()],
    compressedPkd: compressedPkd.hex(),
  };
}
