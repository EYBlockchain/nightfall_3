"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offchainTransaction = exports.getMempool = void 0;
async function getMempool() {
    const { result: mempool } = await this.optimist.get(`/proposer/mempool`);
    return mempool;
}
exports.getMempool = getMempool;
async function offchainTransaction(transaction) {
    const res = await this.optimist.post(`/proposer/offchain-transaction`, transaction, {
        timeout: 3600000,
    });
    return res;
}
exports.offchainTransaction = offchainTransaction;
//# sourceMappingURL=transactions.js.map