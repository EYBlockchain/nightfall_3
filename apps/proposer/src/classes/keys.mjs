import config from 'config';
import { web3 } from './web3.mjs';

const { PROPOSER_KEY } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
export class Keys {
  constructor(privateKey) {
    this.privateKey = privateKey;
    this.address = web3.eth.accounts.privateKeyToAccount(privateKey).address;
  }
}
export const { address, privateKey } = new Keys(PROPOSER_KEY);
