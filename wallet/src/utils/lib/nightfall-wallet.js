/* ignore unused exports */
/**
 * Creates a NighfallWallet from one of the Ethereum wallets in the provider
 * @param {String} privateKey - Ethereum private key to create the walet
 * @returns {Object} Contains the `NighfallWallet` as a NighfallWallet instance
 */
async function createWalletFromEtherAccount(privateKey, ethereumAddress, zkpKeys) {
  const nightfallWallet = {
    privateKey,
    ethereumAddress,
    zkpKeys,
  };

  return nightfallWallet;
}

export default createWalletFromEtherAccount;
