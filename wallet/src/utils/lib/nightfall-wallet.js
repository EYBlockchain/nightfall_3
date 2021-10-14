import { getAddress } from './providers';

/**
 * @class
 * Manage Babyjubjub keys
 * Perform standard wallet actions like signing
 */
class NightfallWallet {
  /**
   * Initialize Babyjubjub wallet from private key
   * @param {Buffer} privateKey - 32 bytes buffer
   * @param {String} ethereumAddress - Hexadecimal string containing the public
   *   Ethereum key from Metamask
   * @param {Object} zkpKeys - Set of keys to operate in nighfall
   */
  constructor(privateKey, ethereumAddress, zkpKeys) {
    if (privateKey.length !== 66) {
      throw new Error('Private key buffer must be 32 bytes');
    }

    this.privateKey = privateKey;
    this.ethereumAddress = ethereumAddress;
    this.zkpKeys = zkpKeys;
  }
}

/**
 * Creates a NighfallWallet from one of the Ethereum wallets in the provider
 * @param {String} privateKey - Ethereum private key to create the walet
 * @returns {Object} Contains the `NighfallWallet` as a NighfallWallet instance
 */
function createWalletFromEtherAccount(privateKey, zkpKeys) {
  const ethereumAddress = getAddress(privateKey);
  const nightfallWallet = new NightfallWallet(privateKey, ethereumAddress, zkpKeys);

  return nightfallWallet;
}

export { NightfallWallet, createWalletFromEtherAccount };
