/* ignore unused exports */

import Web3 from 'web3';

const { ethereum } = global;

export const ChainIdMapping = {
  preprod: { chainId: '0x5', chainName: 'Goerli' },
  testnet: { chainId: '0x5', chainName: 'Goerli' },
  mainnet: { chainId: '0x1', chainName: 'Mainnet' },
  staging: { chainId: '0x5', chainName: 'Goerli' },
  internal: { chainId: '0x5', chainName: 'Goerli' },
  local: { chainId: '0x539', chainName: 'Ganache' }, // 1337
  production: { chainId: '0x1', chainName: 'Mainnet' },
};

export default {
  connectedAccount: undefined,
  connection() {
    if (!this.web3) this.connect();
    return this.web3;
  },

  /**
   * Setup web3 with metamask provider
   * Note: function only supposed to call once
   */
  async connect() {
    if (!ethereum || !ethereum.isMetaMask) {
      throw Error('Wallet is not connected or is not MetaMask', ethereum.isMetaMask);
    }
    this.web3 = new Web3(ethereum);
    global.web3 = this.web3; // for now global.web3 is only set and not referenced anywhere

    [this.connectedAccount] = await ethereum.request({ method: 'eth_requestAccounts' });
    ethereum.on('chainChanged', () => window.location.reload());

    ethereum.on('accountsChanged', ([account]) => {
      this.connectedAccount = account;
    });

    const chainId = await ethereum.request({ method: 'eth_chainId' });
    console.log('Chain ID', chainId);
    if (
      chainId !== ChainIdMapping[process.env.REACT_APP_MODE].chainId &&
      process.env.REACT_APP_MODE !== 'local'
    )
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [
          {
            chainId: ChainIdMapping[process.env.REACT_APP_MODE].chainId,
          },
        ], // chainId must be in hexadecimal numbers
      });

    return ethereum;
  },

  /**
   * Checks the status of connection
   *
   * @return {Boolean} - Resolves to true or false
   */
  isConnected() {
    if (this.web3) {
      return this.web3.eth.net.isListening();
    }
    return false;
  },

  // TODO: fix it - not working with the browser logic
  disconnect() {
    this.web3.currentProvider.connection.close();
  },

  // get account address to which MetaMask is connected
  async getAccount() {
    if (!this.connectedAccount)
      [this.connectedAccount] = await ethereum.request({ method: 'eth_requestAccounts' });
    return this.connectedAccount;
  },

  signMessage(msg) {
    return this.web3.eth.personal.sign(msg, this.connectedAccount);
  },
};
