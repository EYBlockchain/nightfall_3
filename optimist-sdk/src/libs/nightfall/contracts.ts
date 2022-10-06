import { Axios } from 'axios';
import { ContractAddressResponse, ContractsType } from './types';

export default class Contracts {
  contracts: ContractsType = {};
  optimist: Axios;

  constructor({ optimist }) {
    this.optimist = optimist;
  }

  async init(contracts) {
    await Promise.all(
      contracts.map(async c => {
        const { address }: ContractAddressResponse = await this.optimist.get(
          `/contract-address/${c}`,
        );
        this.contracts[c.toLowerCase()] = address;
      }),
    );
    return this.contracts;
  }
}
