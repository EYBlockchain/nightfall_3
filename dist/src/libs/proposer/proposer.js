"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeCurrentProposer = exports.updateProposer = exports.unregisterProposer = exports.registerProposer = exports.getProposers = exports.getCurrentProposer = void 0;
async function getCurrentProposer() {
    const { currentProposer } = await this.optimist.get(`/proposer/current-proposer`);
    return currentProposer;
}
exports.getCurrentProposer = getCurrentProposer;
async function getProposers() {
    const res = await this.optimist.get(`/proposer/proposers`);
    return res;
}
exports.getProposers = getProposers;
async function registerProposer({ stake }) {
    const { txDataToSign: data } = await this.optimist.post(`/proposer/register`, {
        address: this.address,
        url: 'url',
    });
    await this.submitTransaction({
        data,
        value: stake,
    });
}
exports.registerProposer = registerProposer;
async function unregisterProposer() {
    const { txDataToSign: data } = await this.optimist.post(`/proposer/de-register`, {
        address: this.address,
    });
    await this.submitTransaction({ data, value: 0 });
}
exports.unregisterProposer = unregisterProposer;
async function updateProposer(url) {
    const { txDataToSign: data } = await this.optimist.post(`/proposer/update`, {
        address: this.address,
        url,
    });
    await this.submitTransaction({ data });
    console.log(`Proposer with address ${this.address} updated to URL ${url}`);
}
exports.updateProposer = updateProposer;
async function changeCurrentProposer() {
    const { txDataToSign: data } = await this.optimist.get(`/proposer/change`, {
        address: this.address,
    });
    await this.submitTransaction({ data });
}
exports.changeCurrentProposer = changeCurrentProposer;
//# sourceMappingURL=proposer.js.map