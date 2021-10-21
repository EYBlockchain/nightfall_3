import Web3 from 'web3';
import { getProvider } from './providers';

/**
 * Get Ethereum Balance
 * @param {String} address - Ethereum address of account
 * @returns {String} - Ether balance in account
 */
function getL1Balance(address) {
  const provider = getProvider();

  return provider.eth.getBalance(address).then(function (balanceWei) {
    return Web3.utils.fromWei(balanceWei);
  });
}

/**
 * Get EthereumAddress available.
 * @param {String} privateKey - Private Key - optional
 * @returns {String} - Ether balance in account
 */
function getAccounts(privateKey) {
  const provider = getProvider();

  const account =
    typeof privateKey === 'undefined'
      ? provider.eth.getAccounts()
      : provider.eth.accounts.privateKeyToAccount(privateKey);
  return account;
}

/**
 * Signs a message with a given authenticated account
 * @param {String } account - Ethereum address of account
 * @param {String} msg  - Message to sign
 * @returns {Promise} - string with the signature
 */
function signMessage(account, msg) {
  const provider = getProvider();

  return provider.eth.personal.sign(account, msg);
}

/**
 * Returns current network ID
 * @returns {Promise} - Network Id number
 */
function getNetworkId(){
  const provider = getProvider();

  return provider.eth.net.getId();
}

export { getL1Balance, getAccounts, signMessage, getNetworkId };
