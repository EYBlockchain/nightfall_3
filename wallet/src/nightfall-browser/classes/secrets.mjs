/**
 A secrets class
 */
import config from 'config';
import { GN, generalise } from 'general-number';
import rand from '../../common-files/utils/crypto/crypto-random.mjs';
import Commitment from './commitment.mjs';
import {
  enc,
  dec,
  edwardsCompress,
  edwardsDecompress,
} from '../utils/crypto/encryption/elgamal.mjs';
import { calculatePkd } from '../services/keys.mjs';

const { ZKP_KEY_LENGTH, BN128_GROUP_ORDER } = config;

class Secrets {
  ephemeralKeys; // random secret used in shared secret creation

  cipherText;

  squareRootsElligator2; // instead of calculating a square root using Tonelli Shanks algorithm which is required in Elligator 2,
  // we pass the square root and prove that it is indeed the square root of a square number. We do this because Tonelli Shanks require
  // modular exponentiation and we can't do dynamic exponent modular exponentiation in a circuit

  compressedSecrets;

  constructor(ephemeralKeys, cipherText, squareRootsElligator2) {
    this.ephemeralKeys = generalise(ephemeralKeys);
    this.cipherText = generalise(cipherText);
    this.squareRootsElligator2 = generalise(squareRootsElligator2);
    this.compressedSecrets = generalise(
      cipherText.map(text => {
        return edwardsCompress([text[0].bigInt, text[1].bigInt]);
      }),
    );
  }

  // function used to compress secrets to save gas on chain
  static compressSecrets(secrets) {
    return generalise(
      secrets.cipherText.map(text => {
        return edwardsCompress([text[0].bigInt, text[1].bigInt]);
      }),
    );
  }

  // function used to decompress compressed secrets
  static decompressSecrets(secrets) {
    return generalise(secrets).map(secret => {
      return edwardsDecompress(secret.bigInt);
    });
  }

  // function to encrypt secrets
  static async encryptSecrets(messages, publicKey) {
    let ephemeralKeys = [];
    while (ephemeralKeys.length < 4) ephemeralKeys.push(rand(ZKP_KEY_LENGTH));
    ephemeralKeys = (await Promise.all(ephemeralKeys)).map(key => key.bigInt);

    const { cipherText, squareRootsElligator2 } = enc(ephemeralKeys, messages, publicKey);
    const compressedSecrets = cipherText.map(text => {
      return edwardsCompress([text[0], text[1]]);
    });

    return {
      ephemeralKeys: generalise(ephemeralKeys),
      cipherText: generalise(cipherText),
      squareRootsElligator2: generalise(squareRootsElligator2),
      compressedSecrets: generalise(compressedSecrets),
    };
  }

  // function to decrypt secrets
  static decryptSecrets(cipherText, privateKey, newCommitment) {
    const tokenIdProbable = [];
    const saltProbable = [];
    try {
      const decryptedMessages = dec(cipherText, privateKey);
      const ercAddress = generalise(decryptedMessages[0]).hex(32);
      // Since the encrypted message could be an encryption of the positive or the negative congruent form of the same number, we check which of the two
      // satisfy commitment calculation. We do this for both token ID and salt
      tokenIdProbable.push(decryptedMessages[1]);
      tokenIdProbable.push((BN128_GROUP_ORDER - BigInt(decryptedMessages[1])) % BN128_GROUP_ORDER);
      const value = decryptedMessages[2];
      saltProbable.push(decryptedMessages[3]);
      saltProbable.push((BN128_GROUP_ORDER - BigInt(decryptedMessages[3])) % BN128_GROUP_ORDER);
      const { pkd, compressedPkd } = calculatePkd(new GN(privateKey));
      let commitment = {};
      for (let i = 0; i < tokenIdProbable.length; i++) {
        for (let j = 0; j < saltProbable.length; j++) {
          const commitmentProbable = new Commitment({
            compressedPkd,
            pkd,
            ercAddress,
            tokenId: tokenIdProbable[i],
            value,
            salt: saltProbable[j],
          });
          if (commitmentProbable.hash.hex(32) === newCommitment) {
            commitment = commitmentProbable;
          }
        }
      }
      return commitment;
    } catch (err) {
      throw new Error('Decryption error', err);
    }
  }
}

export default Secrets;
