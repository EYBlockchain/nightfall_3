"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class HttpFactory {
    constructor({ environment, options }) {
        const { optimistApiUrl, web3WsUrl } = environment;
        const { estimateGasEndpoint } = options;
        this.optimist = axios_1.default.create({
            baseURL: optimistApiUrl,
        });
        this.optimist.interceptors.response.use(res => res.data);
        this.estimateGasUrl = axios_1.default.create({
            baseURL: estimateGasEndpoint,
        });
        this.estimateGasUrl.interceptors.response.use(res => res.data);
        this.blockchain = axios_1.default.create({
            baseURL: web3WsUrl,
        });
        this.blockchain.interceptors.response.use(res => res.data);
    }
}
exports.default = HttpFactory;
//# sourceMappingURL=http.js.map