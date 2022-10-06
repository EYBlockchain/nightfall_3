"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Gas {
    constructor({ address, defaults, services, web3 }) {
        this.address = address;
        this.defaults = defaults;
        this.services = services;
        this.web3 = web3;
    }
    async estimateGas({ from = this.address, to, tx }) {
        let gasLimit;
        try {
            // Workaround to estimateGas call not working properly on Polygon Edge nodes
            const { data } = await this.services.blockchain.request({
                method: 'eth_estimateGas',
                params: [
                    {
                        from,
                        to,
                        data: tx,
                        value: this.defaults.fee.toString(),
                    },
                ],
            });
            if (data.error)
                throw new Error(data.error);
            gasLimit = parseInt(data.result, 16);
        }
        catch (error) {
            gasLimit = this.defaults.gas; // backup if estimateGas failed
        }
        return Math.ceil(Number(gasLimit) * 2); // 50% seems a more than reasonable buffer.
    }
    async estimateGasPrice() {
        var _a;
        let proposedGasPrice;
        try {
            // Call the endpoint to estimate the gas fee.
            const price = await this.services.estimateGasUrl.get('');
            proposedGasPrice = Number((_a = price === null || price === void 0 ? void 0 : price.result) === null || _a === void 0 ? void 0 : _a.ProposeGasPrice) * 10 ** 9;
        }
        catch (error) {
            try {
                proposedGasPrice = Number(await this.web3.eth.getGasPrice());
            }
            catch (err) {
                proposedGasPrice = this.defaults.gasPrice;
            }
        }
        return Math.ceil(proposedGasPrice * 2);
    }
}
exports.default = Gas;
//# sourceMappingURL=gas.js.map