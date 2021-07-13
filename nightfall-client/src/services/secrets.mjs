import config from 'config';
import Secrets from '../classes/secrets.mjs';
import rand from '../utils/crypto/crypto-random.mjs';
import { enc } from '../utils/crypto/encryption/elgamal.mjs';

const { ZKP_KEY_LENGTH } = config;

// function to encrypt secret data to be sent to recipient of a token transfer
async function encryptSecrets(messages, publicKey) {
  const randomSecrets = [];
  while (randomSecrets.length < 4) randomSecrets.push((await rand(ZKP_KEY_LENGTH)).bigInt);
  const { encryption, sqrts } = enc(randomSecrets, messages, publicKey);
  return new Secrets(randomSecrets, encryption, sqrts);
}

export default encryptSecrets;
