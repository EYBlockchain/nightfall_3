"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const reconnecting_websocket_1 = __importDefault(require("reconnecting-websocket"));
const ws_1 = __importDefault(require("ws"));
const queue_1 = __importDefault(require("queue"));
const contracts_js_1 = __importDefault(require("./contracts.js"));
const index_js_1 = __importDefault(require("../proposer/index.js"));
const gas_js_1 = __importDefault(require("../ethereum/gas.js"));
const http_js_1 = __importDefault(require("../http/http.js"));
const constants_js_1 = require("../../constants.js");
class OptimistSDK extends index_js_1.default {
    constructor({ environment }) {
        super({ environment });
        this.intervalIDs = [];
        this.eventQueue = new queue_1.default({ autostart: true, concurrency: 1 });
        this.connection = new reconnecting_websocket_1.default(environment.optimistWsUrl, [], { WebSocket: ws_1.default });
        this.services = new http_js_1.default({ environment, options: environment.WEB3_OPTIONS });
        // we can't setup up a ping until the connection is made because the ping function
        // only exists in the underlying 'ws' object (_ws) and that is undefined until the
        // websocket is opened, it seems. Hence, we put all this code inside the onopen.
        this.connection.onopen = () => {
            // setup a ping every 15s
            this.intervalIDs.push(setInterval(() => {
                this.connection['_ws'].ping();
            }, constants_js_1.WEBSOCKET_PING_TIME));
            // and a listener for the pong
            console.log('Proposer websocket connection opened');
            this.connection.send('blocks');
        };
        this.connection.onmessage = async (message) => {
            const msg = JSON.parse(message.data);
            const { type, txDataToSign } = msg;
            console.log(`Proposer received websocket message of type ${type}`);
            if (type === 'block') {
                this.eventQueue.push(async () => {
                    try {
                        await this.submitTransaction({
                            data: txDataToSign,
                            to: this.contracts.state,
                            value: environment.DEFAULT_BLOCK_STAKE,
                        });
                    }
                    catch (err) {
                        this.connection.send(JSON.stringify({ type: 'error', data: err }));
                        // block proposed is reverted. Send transactions back to mempool
                        await this.services.optimist.get(`/block/reset-localblock`);
                    }
                });
            }
            return null;
        };
        this.connection.onerror = () => console.log('Proposer websocket connection error');
        this.connection.onclose = () => console.log('Proposer websocket connection closed');
    }
    async init() {
        const contractsInstance = new contracts_js_1.default({ optimist: this.services.optimist });
        this.contracts = await contractsInstance.init(['Proposers', 'State']);
        this.address = await this.web3.eth.accounts.privateKeyToAccount(this.privateKey).address;
        this.gas = new gas_js_1.default({
            address: this.address,
            defaults: this.defaults,
            services: this.services,
            web3: this.web3,
        });
    }
}
exports.default = OptimistSDK;
//# sourceMappingURL=optimistSDK.js.map