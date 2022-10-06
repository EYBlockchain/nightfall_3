import type { WebsocketProvider } from 'web3-core';
import Web3 from 'web3';

export default class Web3Websocket {
  provider: WebsocketProvider;
  web3: Web3;

  constructor({ ws, options }) {
    this.provider = new Web3.providers.WebsocketProvider(ws, options);

    this.web3 = new Web3(this.provider);
    this.web3.eth.transactionBlockTimeout = 2000;
    this.web3.eth.transactionConfirmationBlocks = 1;
    this.addWsEventListeners();
  }

  addWsEventListeners() {
    this.provider.on('connect', () => console.log('Blockchain connected'));
    this.provider.on('end', () => console.log('Blockchain disconnected'));
    this.provider.on('error', () => console.log('Blockchain connection error'));
  }
}
