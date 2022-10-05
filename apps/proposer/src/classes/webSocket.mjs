import ReconnectingWebSocket from 'reconnecting-websocket';
import WebSocket from 'ws';
import config from 'config';
import Queue from 'queue';
import submitTransaction from '../utils/submitTransaction.mjs';
import { contracts } from './contracts.mjs';
import { optimist } from './http.mjs';

const { optimistWsUrl, DEFAULT_BLOCK_STAKE } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { WEBSOCKET_PING_TIME } = config;

class WSocket {
  intervalIDs = [];

  constructor() {
    this.eventQueue = new Queue({ autostart: true, concurrency: 1 });

    this.connection = new ReconnectingWebSocket(optimistWsUrl, [], { WebSocket });

    // we can't setup up a ping until the connection is made because the ping function
    // only exists in the underlying 'ws' object (_ws) and that is undefined until the
    // websocket is opened, it seems. Hence, we put all this code inside the onopen.
    this.connection.onopen = () => {
      // setup a ping every 15s
      this.intervalIDs.push(
        setInterval(() => {
          this.connection._ws.ping();
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
            await submitTransaction({
              data: txDataToSign,
              to: contracts.state,
              value: DEFAULT_BLOCK_STAKE,
            });
            // console.log('sending ', JSON.stringify({ type: 'receipt', data: receipt }));
            // this.connection.send(JSON.stringify({ type: 'receipt', data: receipt }));
          } catch (err) {
            this.connection.send(JSON.stringify({ type: 'error', data: err }));
            // block proposed is reverted. Send transactions back to mempool
            await optimist.get(`/block/reset-localblock`);
          }
        });
      }

      return null;
    };
    this.connection.onerror = () => console.log('Proposer websocket connection error');
    this.connection.onclosed = () => console.log('Proposer websocket connection closed');
  }
}

export default WSocket;
