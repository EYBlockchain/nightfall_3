/* ignore unused exports */
/* eslint no-shadow: "off" */
/* eslint import/no-unresolved: "off" */

import express from 'express';
import config from 'config';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import { proposer, contracts } from './routes/index.mjs';
import { startProposer, checkAndChangeProposer } from './proposer.mjs';
import Nf3 from '../cli/lib/nf3.mjs';

const PROPOSER_PORT = process.env.PROPOSER_PORT || 8092;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const app = express();
const nf3 = new Nf3(environment.PROPOSER_KEY, environment);

app.set('nf3', nf3);

setupHttpDefaults(app, app => {
  app.use('/proposer', proposer);
  app.use('/contract-address', contracts);
});

app.listen(PROPOSER_PORT);

startProposer(nf3, environment.proposerBaseUrl);
setInterval(() => {
  checkAndChangeProposer(nf3);
}, 30000);

export default app;
