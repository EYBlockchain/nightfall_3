"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Contracts {
    constructor({ optimist }) {
        this.optimist = optimist;
    }
    async init(contracts) {
        await Promise.all(contracts.map(async (c) => {
            const { address } = await this.optimist.get(`/contract-address/${c}`);
            this.contracts[c.toLowerCase()] = address;
        }));
        return this.contracts;
    }
}
exports.default = Contracts;
//# sourceMappingURL=contracts.js.map