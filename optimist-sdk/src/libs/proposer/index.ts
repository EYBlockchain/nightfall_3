import Web3Websocket from '../ethereum/web3Websocket.js';
import { ContractsType } from '../nightfall/types.js';
import Web3 from 'web3';
import { Defaults, GasTypes } from '../ethereum/types.js';
import Contracts from '../nightfall/contracts.js';
import Gas from '../ethereum/gas.js';
import BlocksProposer from '../nightfall/proposer.js';
import { Services } from '../http/types.js';
import HttpFactory from '../http/http.js';

export default class InitProposer {
  address: string;
  contracts: ContractsType;
  services: Services;
  web3: Web3;
  defaults: Defaults;
  privateKey: string;
  gas: GasTypes;
  url: string;
  blocksProposer: BlocksProposer;
  environment: any;

  getMempool: Function;
  offchainTransaction: Function;
  getCurrentProposer: Function;
  getProposers: Function;
  registerProposer: Function;
  unregisterProposer: Function;
  updateProposer: Function;
  changeCurrentProposer: Function;
  withdrawStake: Function;
  increaseStake: Function;
  submitTransaction: Function;

  constructor({ environment, privateKey = environment.PROPOSER_KEY, url }) {
    const { gas, gasPrice, fee } = environment.WEB3_OPTIONS;
    const { web3 } = new Web3Websocket({
      ws: environment.web3WsUrl,
      options: environment.WEB3_PROVIDER_OPTIONS,
    });
    this.web3 = web3;

    this.defaults = { gas, gasPrice, fee };
    this.privateKey = privateKey;
    this.url = url;

    this.environment = environment;
    const { optimistApiUrl, web3WsUrl, WEB3_OPTIONS: options } = environment;
    this.services = new HttpFactory({
      optimistApiUrl,
      web3WsUrl,
      options,
    });
  }

  async init() {
    const contractsInstance = new Contracts({ optimist: this.services.optimist });
    this.contracts = await contractsInstance.init(['Proposers', 'State']);

    this.address = await this.web3.eth.accounts.privateKeyToAccount(this.privateKey).address;

    this.gas = new Gas({
      address: this.address,
      defaults: this.defaults,
      services: this.services,
      web3: this.web3,
    });

    this.blocksProposer = new BlocksProposer(this);
  }
}
