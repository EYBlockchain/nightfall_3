import { scalarMult } from 'common-files/utils/curve-maths/curves.mjs';
import config from 'config';
import mimcHash from 'common-files/utils/crypto/mimc/mimc.mjs';
import { randValueLT } from 'common-files/utils/crypto/crypto-random.mjs';
import { generalise, stitchLimbs } from 'general-number';

const { BABYJUBJUB, BN128_GROUP_ORDER } = config;
// DOMAIN_KEM = field(SHA256('nightfall-kem'))
const DOMAIN_KEM = 21033365405711675223813179268586447041622169155539365736392974498519442361181n;
// DOMAIN_KEM = field(SHA256('nightfall-dem'))
const DOMAIN_DEM = 1241463701002173366467794894814691939898321302682516549591039420117995599097n;

/**
This function is like splice but replaces the element in index and returns a new array
@function immutableSplice
@param {Array} array - The list that will be spliced into
@param {number} index - The index to be spliced into
@param {any} element - The element to be placed in index
@returns {Array} An updated array with element spliced in at index.
*/
const immutableSplice = (array, index, element) => {
  const safeIndex = Math.max(index, 0);
  const beforeElement = array.slice(0, safeIndex);
  const afterElement = array.slice(safeIndex + 1);
  return [...beforeElement, element, ...afterElement];
};

/**
This helper function moves the top most 32-bits from one general number to another
@function packSecrets
@param {GeneralNumber} from - The general number which the top more 32-bits will be taken from
@param {GeneralNumber} to - The general number which the top more 32-bits will be inserted into
@param {number} topMostFromBytesIndex - Index to move custom bit positions from
@param {number} topMostToBytesIndex - Index to move custom bit positions to
@returns {Array<GeneralNumber>} The two general numbers after moving the 32-bits.
*/
const packSecrets = (from, to, topMostFromBytesIndex, topMostToBytesIndex) => {
  if (topMostFromBytesIndex >= 8 || topMostToBytesIndex >= 8)
    throw new Error('This function packs u32[8], indices must be < 8');
  const fromLimbs = from.limbs(32, 8);
  const toLimbs = to.limbs(32, 8);
  if (toLimbs[0] !== '0') throw new Error('Cannot pack since top bits non-zero');

  if (topMostToBytesIndex + 1 === toLimbs.length)
    throw new Error('Pack To Array is zero, need to specify to address');
  const topMostBytes = fromLimbs[topMostFromBytesIndex];

  const unpackedFrom = immutableSplice(fromLimbs, topMostFromBytesIndex, '0');
  const packedTo = immutableSplice(toLimbs, topMostToBytesIndex, topMostBytes);
  return [generalise(stitchLimbs(unpackedFrom, 32)), generalise(stitchLimbs(packedTo, 32))];
};

/**
This function generates the ephemeral key pair used in the kem-dem
@function genEphemeralKeys
@returns {Promise<Array<GeneralNumber, Array<BigInt>>>} The private and public key pair
*/
const genEphemeralKeys = async () => {
  const privateKey = await randValueLT(BN128_GROUP_ORDER);
  const publicKey = scalarMult(privateKey.bigInt, BABYJUBJUB.GENERATOR);
  return [privateKey, publicKey];
};

/**
This function performs the key encapsulation step, deriving a symmetric encryption key from a shared secret.
@function kem
@param {GeneralNumber} privateKey - The private key related to either the ephemeralPub or recipientPubKey (depending on operation)
@param {Array<GeneralNumber>} ephemeralPub - The general number which the top more 32-bits will be inserted into
@param {Array<GeneralNumber>} recipientPubKey - The recipientPkd, in decryption this is also the ephemeralPub
@returns {Array<Array<GeneralNumber>, BigInt>>} The ephemeralPub key and the symmteric key used for encryption
*/
const kem = (privateKey, recipientPubKey) => {
  const sharedSecret = scalarMult(
    privateKey.bigInt,
    recipientPubKey.map(r => r.bigInt),
  );
  return mimcHash([sharedSecret[0], sharedSecret[1], DOMAIN_KEM]);
};

/**
This function performs the data encapsulation step, encrypting the plaintext
@function dem
@param {BigInt} encryptionKey - The symmetric encryption key
@param {Array<BigInt>} plaintexts - The array of plain text to be encrypted
@returns {Array<BigInt>} The encrypted ciphertexts.
*/
const dem = (encryptionKey, plaintexts) =>
  plaintexts.map(
    (p, i) => (mimcHash([encryptionKey, DOMAIN_DEM, BigInt(i)]) + p) % BN128_GROUP_ORDER,
  );

/**
This function inverts the data encapsulation step, decrypting the ciphertext
@function deDem
@param {BigInt} encryptionKey - The symmetric encryption key
@param {Array<GeneralNumber>} ciphertexts - The array of ciphertexts to be decrypted
@returns {Array<BigInt>} The decrypted plaintexts.
*/
const deDem = (encryptionKey, ciphertexts) => {
  const plainTexts = ciphertexts.map((c, i) => {
    const pt = c.bigInt - BigInt(mimcHash([encryptionKey, DOMAIN_DEM, BigInt(i)]));
    if (pt < 0) return ((pt % BN128_GROUP_ORDER) + BN128_GROUP_ORDER) % BN128_GROUP_ORDER;
    return pt % BN128_GROUP_ORDER;
  });
  return plainTexts;
};

/**
This function performs the kem-dem required to encrypt plaintext.
@function encrypt
@param {GeneralNumber} ephemeralPrivate - The private key that generates the ephemeralPub
@param {Array<GeneralNumber>} ephemeralPub - The ephemeralPubKey
@param {Array<GeneralNumber>} recipientPkds - The public pkd of the recipients
@param {Array<BigInt>} plaintexts - The array of plain text to be encrypted, the ordering is [ercAddress,tokenId, value, salt]
@returns {Array<BigInt>} The encrypted ciphertexts.
*/
const encrypt = (ephemeralPrivate, recipientPkds, plaintexts) => {
  const encKey = kem(ephemeralPrivate, recipientPkds);
  return dem(encKey, plaintexts);
  // return cipherTexts;
};

/**
This function performs the kem-deDem required to decrypt plaintext.
@function decrypt
@param {GeneralNumber} privateKey - The private key of the recipient pkd
@param {Array<GeneralNumber>} ephemeralPub - The ephemeralPubKey
@param {Array<GeneralNumber>} ciphertexts - The array of ciphertexts to be decrypted
@returns {Array<GeneralNumber>} The decrypted plaintexts, the ordering is [ercAddress,tokenId, value, salt]
*/
const decrypt = (privateKey, ephemeralPub, cipherTexts) => {
  const encKey = kem(privateKey, ephemeralPub);
  return deDem(encKey, cipherTexts);
};

export { encrypt, decrypt, genEphemeralKeys, packSecrets };
