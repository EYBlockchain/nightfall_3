import getContractAddress from '../utils/contractAddress.mjs';

export class ContractsFactory {
  contracts = {};

  async init(contracts) {
    await Promise.all(
      contracts.map(async c => {
        this.contracts[c.toLowerCase()] = await getContractAddress(c);
      }),
    );
    return this.contracts;
  }
}

const contractsInstance = new ContractsFactory();

/**
 *
 * TODO constants
 *
 */
export const contracts = await contractsInstance.init(['Proposers', 'State']);
