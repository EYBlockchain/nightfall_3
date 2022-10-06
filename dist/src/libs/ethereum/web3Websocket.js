"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_1 = __importDefault(require("web3"));
class Web3Websocket {
    constructor({ ws, options }) {
        this.provider = new web3_1.default.providers.WebsocketProvider(ws, options);
        this.web3 = new web3_1.default(this.provider);
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
exports.default = Web3Websocket;
//# sourceMappingURL=web3Websocket.js.map