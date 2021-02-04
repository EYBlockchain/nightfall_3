import WebSocket from 'ws';
import config from 'config';
import logger from './logger.mjs';

const { ORCHESTRATOR_WS_HOST, ORCHESTRATOR_WS_PORT } = config;

// let client;

export default function submitChallenge(message) {
  const client = new WebSocket(`ws://${ORCHESTRATOR_WS_HOST}:${ORCHESTRATOR_WS_PORT}`);
  client.on('open', () => {
    logger.info('Websocket connection open with server');
    logger.debug(
      `raw challenge transaction has been sent to be signed and submitted ${JSON.stringify(
        message,
        null,
        2,
      )}`,
    );
    client.send(message);
  });
  client.on('error', () => {
    logger.info('Websocket connection failed. Retrying... ');
    submitChallenge();
  });
  client.on('close', () => {
    logger.info('Websocket disconnected');
  });
}
