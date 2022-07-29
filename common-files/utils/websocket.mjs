/* ignore unused exports */
import WebSocket from 'ws';
import logger from './logger.mjs';

export class NFWebsocket {
  constructor({ port, pingTime }) {
    this.wss = new WebSocket.Server({ port });
    this.pingTime = pingTime;
  }

  /**
    Function that does some standardised setting up of a websocket's events.
    It logs open, close and error events, sets up a ping and logs the pong. It will
    close the socket on pong failure.  The user is expected to handle the reconnect.
    It does not set up the onmessage event because this tends to be case-specific.
    */
  setupWebsocketEvents(ws, socketName) {
    let timeoutID;
    // setup a pinger to ping the websocket correspondent
    const intervalID = setInterval(() => {
      ws.ping();
      // set up a timeout - will close the websocket, which will trigger a reconnect
      timeoutID = setTimeout(() => {
        logger.warn(`Timed out waiting for ping response from ${socketName}`);
        this.ws.terminate();
      }, 2 * this.pingTime);
    }, this.pingTime);
    // check we received a pong in time (clears the timer set by the pinger)
    ws.on('pong', () => {
      // logger.debug(`Got pong from ${socketName} websocket`);
      clearTimeout(timeoutID);
    });
    ws.on('error', () => {
      logger.debug(`ERROR ${socketName}`);
    });
    ws.on('open', () => {
      logger.debug(`OPEN ${socketName}`);
    });
    ws.on('close', err => {
      logger.debug(`CLOSE ${socketName} ${err}`);
      clearInterval(intervalID);
    });
  }

  subscribe({ topic, socketName, filter }, callback) {
    this.wss.on('connection', ws => {
      console.log('connected', socketName);
      ws.on('message', message => {
        console.log('msg', message);
        try {
          if (filter === 'type' && JSON.parse(message).type === topic) {
            logger.info(`SUBSCRIBING TO PROPOSEDBLOCK`);
            this.setupWebsocketEvents(ws, socketName);
            callback(ws);
          } else if (message === topic) {
            this.setupWebsocketEvents(ws, socketName);
            callback(ws);
          }
        } catch (err) {
          logger.debug('Unrecognized websocket message', message);
        }
      });

      logger.debug(`Subscribed to ${socketName} WebSocket connection`);
    });
  }
}

export function submitBlockToWS(ws, data, id) {
  const message = JSON.stringify({
    id,
    ...data,
  });

  return new Promise(function (resolve) {
    let ack = false;
    ws.once('message', function (msg) {
      if (msg === id) ack = true;
    });

    const retry = () => ws.send(message);
    const delay = () =>
      new Promise((_, reject) => {
        setTimeout(reject, 10000);
      });
    const checkAck = () => {
      if (ack) return ack;
      throw ack;
    };

    let p = Promise.reject();
    for (let i = 0; i < 2; i++) {
      p = p
        .catch(retry)
        .then(() => {
          checkAck();
          resolve();
        })
        .catch(delay);
    }
  });
}
