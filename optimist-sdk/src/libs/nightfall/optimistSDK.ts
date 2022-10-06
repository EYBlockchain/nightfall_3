import ReconnectingWebSocket from 'reconnecting-websocket';
import WebSocket from 'ws';
import Queue from 'queue';
import Contracts from './contracts.js';
import { ContractsType } from './types.js';
import Proposer from '../proposer/index.js';
import Gas from '../ethereum/gas.js';
import { Defaults, GasTypes } from '../ethereum/types.js';
import { Axios } from 'axios';
import HttpFactory from '../http/http.js';
import Web3 from 'web3';
import { Services } from '../http/types.js';
import { WEBSOCKET_PING_TIME } from '../../constants.js';

export default class OptimistSDK extends Proposer {
  intervalIDs: Array<NodeJS.Timeout> = [];
  eventQueue: Queue;
  connection: ReconnectingWebSocket;
  contracts: ContractsType;
  gas: GasTypes;
  web3: Web3;
  privateKey: string;
  defaults: Defaults;
  services: Services;

  constructor({ environment }) {
    super({ environment });
    this.eventQueue = new Queue({ autostart: true, concurrency: 1 });
    this.connection = new ReconnectingWebSocket(environment.optimistWsUrl, [], { WebSocket });

    this.services = new HttpFactory({ environment, options: environment.WEB3_OPTIONS });

    // we can't setup up a ping until the connection is made because the ping function
    // only exists in the underlying 'ws' object (_ws) and that is undefined until the
    // websocket is opened, it seems. Hence, we put all this code inside the onopen.
    this.connection.onopen = () => {
      // setup a ping every 15s
      this.intervalIDs.push(
        setInterval(() => {
          this.connection['_ws'].ping();
        }, WEBSOCKET_PING_TIME),
      );
      // and a listener for the pong
      console.log('Proposer websocket connection opened');
      this.connection.send('blocks');
    };

    this.connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign } = msg;
      console.log(`Proposer received websocket message of type ${type}`);

      if (type === 'block') {
        this.eventQueue.push(async () => {
          try {
            await this.submitTransaction({
              data: txDataToSign,
              to: this.contracts.state,
              value: environment.DEFAULT_BLOCK_STAKE,
            });
          } catch (err) {
            console.log('proposer error2', err);
            // this.connection.send(JSON.stringify({ type: 'error', data: err }));
            // block proposed is reverted. Send transactions back to mempool
            await this.services.optimist.get(`/block/reset-localblock`);
          }
        });
      }

      return null;
    };
    this.connection.onerror = () => console.log('Proposer websocket connection error');
    this.connection.onclose = () => console.log('Proposer websocket connection closed');
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
  }
}
