/* ignore unused exports */
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

const STORAGE_VERSION_KEY = 'nightfallStorageVersion';
const STORAGE_VERSION = 1;
const TOKEN_POOL_KEY = 'nightfallTokensPool';
const MNEMONIC_KEY = 'nightfallMnemonic';

const storage = window.localStorage;

const encryptWithAES = (text, passphrase) => {
  return AES.encrypt(text, passphrase).toString();
};

const decryptWithAES = (ciphertext, passphrase) => {
  const bytes = AES.decrypt(ciphertext, passphrase);
  return bytes.toString(Utf8);
};

function init() {
  if (!storage.getItem(STORAGE_VERSION_KEY)) {
    storage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  }
}

function mnemonicSet(userKey, mnemonic, passphrase) {
  init();
  if (!storage.getItem(MNEMONIC_KEY + userKey) && passphrase) {
    const ciphertext = encryptWithAES(mnemonic, passphrase);
    storage.setItem(MNEMONIC_KEY + userKey, ciphertext);
  }
}

function mnemonicGet(userKey, passphrase) {
  const ciphertext = storage.getItem(MNEMONIC_KEY + userKey);
  if (typeof passphrase === 'undefined') {
    return ciphertext;
  }
  if (ciphertext) {
    return decryptWithAES(ciphertext, passphrase);
  }
  return ciphertext;
}

function mnemonicRemove(userKey) {
  storage.removeItem(MNEMONIC_KEY + userKey);
}

function tokensSet(userKey, tokens) {
  init();
  storage.setItem(TOKEN_POOL_KEY + userKey, JSON.stringify(tokens));
}

function tokensGet(userKey) {
  return storage.getItem(TOKEN_POOL_KEY + userKey);
}

function clear() {
  storage.clear();
}

export { mnemonicGet, mnemonicSet, mnemonicRemove, tokensSet, tokensGet, clear };
