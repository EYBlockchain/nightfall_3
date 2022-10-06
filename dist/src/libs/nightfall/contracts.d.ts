import { Axios } from 'axios';
import { ContractsType } from './types';
export default class Contracts {
    contracts: ContractsType;
    optimist: Axios;
    constructor({ optimist }: {
        optimist: any;
    });
    init(contracts: any): Promise<ContractsType>;
}
