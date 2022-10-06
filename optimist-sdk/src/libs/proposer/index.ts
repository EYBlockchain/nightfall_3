import Web3Websocket from '../ethereum/web3Websocket.js';
import {
  changeCurrentProposer,
  getCurrentProposer,
  getProposers,
  registerProposer,
  unregisterProposer,
  updateProposer,
} from './proposer.js';
import withdrawStake from './stake.js';
import { getMempool, offchainTransaction } from './transactions.js';
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

  constructor({ environment }) {
    const { gas, gasPrice, fee } = environment.WEB3_OPTIONS;
    const { web3 } = new Web3Websocket({
      ws: environment.web3WsUrl,
      options: environment.WEB3_PROVIDER_OPTIONS,
    });
    this.web3 = web3;

    this.defaults = { gas, gasPrice, fee };
    this.privateKey = environment.PROPOSER_KEY;
  }

  async submitTransaction({
    from = this.address,
    to = this.contracts.proposers,
    data,
    value = this.defaults.fee,
  }) {
    // estimate the gasPrice and gas limit
    const gasPrice = await this.gas.estimateGasPrice();
    const gas = await this.gas.estimateGas(from, data);

    const tx = {
      from,
      to,
      data,
      value,
      gas,
      gasPrice,
    };

    const signed = await this.web3.eth.accounts.signTransaction(tx, this.privateKey);
    const promiseTest = new Promise((resolve, reject) => {
      this.web3.eth
        .sendSignedTransaction(signed.rawTransaction!)
        .once('receipt', async receipt => {
          console.log('receipt', receipt);
          resolve(receipt);
        })
        .on('error', err => {
          console.log('proposer error', err);
          reject(err);
        });
    });

    return promiseTest;
  }
}

Proposer.prototype.getMempool = getMempool;
Proposer.prototype.offchainTransaction = offchainTransaction;

Proposer.prototype.getCurrentProposer = getCurrentProposer;
Proposer.prototype.getProposers = getProposers;
Proposer.prototype.registerProposer = registerProposer;
Proposer.prototype.unregisterProposer = unregisterProposer;
Proposer.prototype.updateProposer = updateProposer;
Proposer.prototype.changeCurrentProposer = changeCurrentProposer;

Proposer.prototype.withdrawStake = withdrawStake;
