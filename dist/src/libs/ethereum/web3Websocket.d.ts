import type { WebsocketProvider } from 'web3-core';
import Web3 from 'web3';
export default class Web3Websocket {
    provider: WebsocketProvider;
    web3: Web3;
    constructor({ ws, options }: {
        ws: any;
        options: any;
    });
    addWsEventListeners(): void;
}
