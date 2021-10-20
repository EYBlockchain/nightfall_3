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

function getAddress(privateKey) {
  if (!provider) {
    throw new Error('Provider not initialized');
  }

  const account = provider.eth.accounts.privateKeyToAccount(privateKey);

  return account.address;
}

function getL1Balance(address) {
  if (!provider) {
    throw new Error('Provider not initialized');
  }

  return provider.eth.getBalance(address).then(function (balanceWei) {
    return Web3.utils.fromWei(balanceWei);
  });
}

export { setProvider, getProvider, getAddress, getL1Balance };
