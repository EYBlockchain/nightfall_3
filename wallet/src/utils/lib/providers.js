/* ignore unused exports */
import Web3 from 'web3';

let provider;

/**
 * Set a Provider URL
 * @param {String|Object} providerData - Network url (i.e, http://localhost:8545) or an Object with the information to set the provider
 */
function setProvider(providerData) {
  if (typeof providerData === 'string' || typeof window === 'undefined') {
    provider = new Web3(providerData);
  }

  if (window.ethereum) {
    provider = new Web3(window.ethereum);
    window.ethereum.send('eth_requestAccounts');
  }
}

/**
 * Retrieve provider
 * @param {String|Object} providerData - Network url (i.e, http://localhost:8545) or an Object with the information to set the provider
 * @returns {Object} provider
 */
function getProvider(providerData) {
  if (!provider) {
    setProvider(providerData);
  }

  return provider;
}

export { setProvider, getProvider };
