"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3Websocket_js_1 = __importDefault(require("../ethereum/web3Websocket.js"));
const proposer_js_1 = require("./proposer.js");
const stake_js_1 = __importDefault(require("./stake.js"));
const transactions_js_1 = require("./transactions.js");
class Proposer {
    constructor({ environment }) {
        const { gas, gasPrice, fee } = environment.WEB3_OPTIONS;
        const { web3 } = new web3Websocket_js_1.default({
            ws: environment.web3WsUrl,
            options: environment.WEB3_PROVIDER_OPTIONS,
        });
        this.web3 = web3;
        this.defaults = { gas, gasPrice, fee };
        this.privateKey = environment.PROPOSER_KEY;
    }
    async submitTransaction({ from = this.address, to = this.contracts.proposers, data, value = this.defaults.fee, }) {
        // estimate the gasPrice and gas limit
        const gasPrice = await this.gas.estimateGasPrice();
        const gas = await this.gas.estimateGas(from, data);
        const tx = {
            from,
            to,
            data,
            value,
            gas,
            gasPrice,
        };
        const signed = await this.web3.eth.accounts.signTransaction(tx, this.privateKey);
        const promiseTest = new Promise((resolve, reject) => {
            this.web3.eth
                .sendSignedTransaction(signed.rawTransaction)
                .once('receipt', async (receipt) => {
                console.log('receipt', receipt);
                resolve(receipt);
            })
                .on('error', err => {
                reject(err);
            });
        });
        return promiseTest;
    }
}
exports.default = Proposer;
Proposer.prototype.getMempool = transactions_js_1.getMempool;
Proposer.prototype.offchainTransaction = transactions_js_1.offchainTransaction;
Proposer.prototype.getCurrentProposer = proposer_js_1.getCurrentProposer;
Proposer.prototype.getProposers = proposer_js_1.getProposers;
Proposer.prototype.registerProposer = proposer_js_1.registerProposer;
Proposer.prototype.unregisterProposer = proposer_js_1.unregisterProposer;
Proposer.prototype.updateProposer = proposer_js_1.updateProposer;
Proposer.prototype.changeCurrentProposer = proposer_js_1.changeCurrentProposer;
Proposer.prototype.withdrawStake = stake_js_1.default;
//# sourceMappingURL=index.js.map