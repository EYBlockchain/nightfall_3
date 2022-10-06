import Web3 from 'web3';
import { Services } from '../http/types';
import { Defaults, EstimateGasResponse } from './types';

export default class Gas {
  address: string;
  web3: Web3;
  defaults: Defaults;
  services: Services;

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
      if (data.error) throw new Error(data.error);
      gasLimit = parseInt(data.result, 16);
    } catch (error) {
      gasLimit = this.defaults.gas; // backup if estimateGas failed
    }
    return Math.ceil(Number(gasLimit) * 2); // 50% seems a more than reasonable buffer.
  }

  async estimateGasPrice() {
    let proposedGasPrice;
    try {
      // Call the endpoint to estimate the gas fee.
      const price: EstimateGasResponse = await this.services.estimateGasUrl.get('');
      proposedGasPrice = Number(price?.result?.ProposeGasPrice) * 10 ** 9;
    } catch (error) {
      try {
        proposedGasPrice = Number(await this.web3.eth.getGasPrice());
      } catch (err) {
        proposedGasPrice = this.defaults.gasPrice;
      }
    }
    return Math.ceil(proposedGasPrice * 2);
  }
}
