export default class Keys {
  constructor(privateKey, web3) {
    this.privateKey = privateKey;
    this.address = web3.eth.accounts.privateKeyToAccount(privateKey).address;
  }
}
