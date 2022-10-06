import Web3 from 'web3';
import { Services } from '../http/types';
import { Defaults } from './types';
export default class Gas {
    address: string;
    web3: Web3;
    defaults: Defaults;
    services: Services;
    constructor({ address, defaults, services, web3 }: {
        address: any;
        defaults: any;
        services: any;
        web3: any;
    });
    estimateGas({ from, to, tx }: {
        from?: string;
        to: any;
        tx: any;
    }): Promise<number>;
    estimateGasPrice(): Promise<number>;
}
