import Queue from 'queue';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { WEBSOCKET_PING_TIME } from '../../constants.js';
import WebSocket from 'ws';
import InitProposer from '../proposer/index.js';
import {
  changeCurrentProposer,
  getCurrentProposer,
  getProposers,
  registerProposer,
  unregisterProposer,
  updateProposer,
} from '../proposer/proposer.js';
import { withdrawStake, increaseStake } from '../proposer/stake.js';
import { getMempool, offchainTransaction } from '../proposer/transactions.js';
import submitTransaction from '../proposer/submitTransaction.js';

export default class Proposer extends InitProposer {
  eventQueue: Queue;
  connection: ReconnectingWebSocket;
  intervalIDs: Array<NodeJS.Timeout> = [];
  optimistWs: string;

  constructor({ environment, privateKey = environment.PROPOSER_KEY, url }) {
    super({ environment, privateKey, url });

    this.optimistWs = environment.optimistWsUrl;
    this.eventQueue = new Queue({ autostart: true, concurrency: 1 });
    this.connection = new ReconnectingWebSocket(this.optimistWs, [], { WebSocket });
  }

  stop() {
    delete this.connection;
  }

  start() {
    this.connection = new ReconnectingWebSocket(this.optimistWs, [], { WebSocket });

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

    this.connection.onerror = () => console.log('Proposer websocket connection error');
    this.connection.onclose = () => console.log('Proposer websocket connection closed');

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
              value: this.environment.DEFAULT_BLOCK_STAKE,
            });
          } catch (err) {
            // block proposed is reverted. Send transactions back to mempool
            await this.services.optimist.get(`/block/reset-localblock`);
          }
        });
      }

      return null;
    };
  }
}

Proposer.prototype.submitTransaction = submitTransaction;

Proposer.prototype.getMempool = getMempool;
Proposer.prototype.offchainTransaction = offchainTransaction;

Proposer.prototype.getCurrentProposer = getCurrentProposer;
Proposer.prototype.getProposers = getProposers;
Proposer.prototype.registerProposer = registerProposer;
Proposer.prototype.unregisterProposer = unregisterProposer;
Proposer.prototype.updateProposer = updateProposer;
Proposer.prototype.changeCurrentProposer = changeCurrentProposer;

Proposer.prototype.withdrawStake = withdrawStake;
Proposer.prototype.increaseStake = increaseStake;
