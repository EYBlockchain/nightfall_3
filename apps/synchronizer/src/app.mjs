/* ignore unused exports */
/* eslint no-shadow: "off" */

import express from 'express';
import config from 'config';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import { contracts } from './routes/index.mjs';
import Nf3 from '../../../cli/lib/nf3.mjs';
import startSynchronizer from './synchronizer.mjs';

const { SYNCHRONIZER_PORT } = config;
const {
  CLIENT_URL = '',
  OPTIMIST_HTTP_URL = '',
  OPTIMIST_WS_URL = '',
  BLOCKCHAIN_URL = '',
} = process.env;
const environment = {
  clientApiUrl:
    `${CLIENT_URL}` !== '' ? `${CLIENT_URL}` : `http://${config.CLIENT_HOST}:${config.CLIENT_PORT}`,
  optimistApiUrl:
    `${OPTIMIST_HTTP_URL}` !== ''
      ? `${OPTIMIST_HTTP_URL}`
      : `http://${config.OPTIMIST_HOST}:${config.OPTIMIST_PORT}`,
  optimistWsUrl: `${OPTIMIST_WS_URL}`
    ? `${OPTIMIST_WS_URL}`
    : `ws://${config.OPTIMIST_HOST}:${config.OPTIMIST_WS_PORT}`,
  web3WsUrl: `${BLOCKCHAIN_URL}`
    ? `${BLOCKCHAIN_URL}`
    : `ws://${config.BLOCKCHAIN_WS_HOST}:${config.BLOCKCHAIN_PORT}${config.BLOCKCHAIN_PATH}`,
};

const app = express();
const nf3 = new Nf3('', environment);

app.set('nf3', nf3);

setupHttpDefaults(app, app => {
  app.use('/contract-address', contracts);
});

app.listen(SYNCHRONIZER_PORT);

startSynchronizer(nf3);

export default app;
