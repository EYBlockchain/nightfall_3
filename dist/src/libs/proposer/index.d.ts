import { ContractsType } from '../nightfall/types.js';
import Web3 from 'web3';
import { Defaults, GasTypes } from '../ethereum/types.js';
export default class Proposer {
    address: string;
    contracts: ContractsType;
    web3: Web3;
    defaults: Defaults;
    privateKey: string;
    gas: GasTypes;
    getMempool: Function;
    offchainTransaction: Function;
    getCurrentProposer: Function;
    getProposers: Function;
    registerProposer: Function;
    unregisterProposer: Function;
    updateProposer: Function;
    changeCurrentProposer: Function;
    withdrawStake: Function;
    constructor({ environment }: {
        environment: any;
    });
    submitTransaction({ from, to, data, value, }: {
        from?: string;
        to?: string;
        data: any;
        value?: number;
    }): Promise<unknown>;
}
