"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function withdrawStake() {
    const { txDataToSign: data } = await this.optimist.post(`/proposer/withdrawBond`, {
        address: this.address,
    });
    await this.submitTransaction({ data });
}
exports.default = withdrawStake;
//# sourceMappingURL=stake.js.map