import { scalarMult } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import { generalise, stitchLimbs, GN } from 'general-number';
import poseidon from '@polygon-nightfall/common-files/utils/crypto/poseidon/poseidon.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

const { BABYJUBJUB, BN128_GROUP_ORDER } = constants;
// DOMAIN_KEM = field(SHA256('nightfall-kem'))
const DOMAIN_KEM = 21033365405711675223813179268586447041622169155539365736392974498519442361181n;
// DOMAIN_KEM = field(SHA256('nightfall-dem'))
const DOMAIN_DEM = 1241463701002173366467794894814691939898321302682516549591039420117995599097n;

const BABYJUBJUB_GROUP_ORDER = BABYJUBJUB.JUBJUBE / BABYJUBJUB.JUBJUBC;
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
  if (toLimbs[topMostToBytesIndex] !== '0') throw new Error('Cannot pack since top bits non-zero');

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
  const privateKey = await randValueLT(BABYJUBJUB_GROUP_ORDER);
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
  return poseidon(generalise([sharedSecret[0], sharedSecret[1], DOMAIN_KEM])).bigInt;
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
    (p, i) =>
      (poseidon(generalise([encryptionKey, DOMAIN_DEM, BigInt(i)])).bigInt + p) % BN128_GROUP_ORDER,
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
    const pt = c.bigInt - poseidon(generalise([encryptionKey, DOMAIN_DEM, BigInt(i)])).bigInt;
    if (pt < 0) return ((pt % BN128_GROUP_ORDER) + BN128_GROUP_ORDER) % BN128_GROUP_ORDER;
    return pt % BN128_GROUP_ORDER;
  });
  return plainTexts;
};

/**
This function generates the transfer key pair for the observers
@function genTransferKeysForObservers
@param {GeneralNumber} senderPrivateKey - The private key of the sender
@param {Array<GeneralNumber>} receiverPublicKey - The public pkd of the recipient
@returns {Promise<Array<GeneralNumber, Array<BigInt>>>} The private and public key pair
*/
const genTransferKeysForObservers = async (senderPrivateKey, receiverPublicKey) => {
  // We generate a private key derived from sender private key and receiver private key
  // to be deterministic for the sender
  let privateKey = await kem(senderPrivateKey, receiverPublicKey).toString(16);
  privateKey = new GN(`0x${privateKey}`, 'hex');
  const publicKey = scalarMult(privateKey.bigInt, BABYJUBJUB.GENERATOR);
  return [privateKey, publicKey];
};

/**
This function gets a random nonce between min and max.
@function randomNonce
@param {Number} min - Min value of the nonce
@param {Number} max - Max value of the nonce
@returns {GeneralNumber} The random hex nonce 
*/
export const randomNonce = (min, max) => {
  const nonce = BigInt(Math.floor(Math.random() * (max - min + 1) + min));
  return nonce;
};

/**
This function performs the kem-dem required to encrypt plaintext.
@function encrypt
@param {GeneralNumber} ephemeralPrivate - The private key that generates the ephemeralPub
@param {Array<GeneralNumber>} ephemeralPub - The ephemeralPubKey
@param {Array<GeneralNumber>} recipientPkds - The public pkd of the recipients
@param {Array<BigInt>} plaintexts - The array of plain text to be encrypted, the ordering is [ercAddress,tokenId, value, salt]
@param {BigInt} nonce - Nonce to do XOR
@returns {Array<BigInt>} The encrypted ciphertexts.
*/
const encrypt = (ephemeralPrivate, recipientPkds, plaintexts, nonce) => {
  let encKey = kem(ephemeralPrivate, recipientPkds);
  if (nonce) {
    // eslint-disable-next-line no-bitwise
    encKey ^= nonce;
  }
  return dem(encKey, plaintexts);
};

/**
This function performs the kem-deDem required to decrypt plaintext.
@function decrypt
@param {GeneralNumber} privateKey - The private key of the recipient pkd
@param {Array<GeneralNumber>} ephemeralPub - The ephemeralPubKey
@param {Array<GeneralNumber>} ciphertexts - The array of ciphertexts to be decrypted
@param {BigInt} nonce - Nonce to do XOR
@returns {Array<GeneralNumber>} The decrypted plaintexts, the ordering is [ercAddress,tokenId, value, salt]
*/
const decrypt = (privateKey, ephemeralPub, cipherTexts, nonce) => {
  let encKey = kem(privateKey, ephemeralPub);
  if (nonce) {
    // eslint-disable-next-line no-bitwise
    encKey ^= nonce;
  }
  return deDem(encKey, cipherTexts);
};

export { encrypt, decrypt, genEphemeralKeys, genTransferKeysForObservers, packSecrets };
