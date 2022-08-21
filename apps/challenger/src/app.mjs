/* ignore unused exports */
/* eslint no-shadow: "off" */

import express from 'express';
import config from 'config';
import { setupHttpDefaults } from 'common-files/utils/httputils.mjs';
import Nf3 from '../../../cli/lib/nf3.mjs';
import startChallenger from './challenger.mjs';

const { SIGNING_KEY, CHALLENGER_PORT } = config;
const {
  CLIENT_URL = '',
  OPTIMIST_HTTP_URL = '',
  OPTIMIST_WS_URL = '',
  BLOCKCHAIN_URL = '',
  PROPOSER_URL = '',
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
    : `ws://${config.BLOCKCHAIN_WS_HOST}:${config.BLOCKCHAIN_PORT}`,
  proposerBaseUrl: `${PROPOSER_URL}`
    ? `${PROPOSER_URL}`
    : `http://${process.env.PROPOSER_HOST}:${process.env.PROPOSER_PORT}`,
};

const app = express();
const nf3 = new Nf3(SIGNING_KEY, environment);

app.set('nf3', nf3);

setupHttpDefaults(app);

app.listen(CHALLENGER_PORT);

startChallenger(nf3);

export default app;
