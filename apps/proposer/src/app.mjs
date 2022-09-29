/* ignore unused exports */
/* eslint no-shadow: "off" */
/* eslint import/no-unresolved: "off" */

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import config from 'config';
import YAML from 'yaml';
import fs from 'fs';
import Web3 from 'web3';
import { setupHttpDefaults } from '../common-files/utils/httputils.mjs';
import { proposer, contracts } from './routes/index.mjs';
import logger from '../common-files/utils/logger.mjs';
import Keys from './utils/keys.mjs';

const { web3WsUrl, PROPOSER_KEY } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const { WEB3_PROVIDER_OPTIONS } = config;
const PROPOSER_PORT = process.env.PROPOSER_PORT || 80;

const web3Provider = new Web3.providers.WebsocketProvider(web3WsUrl, WEB3_PROVIDER_OPTIONS);

const web3 = new Web3(web3Provider);
web3.eth.transactionBlockTimeout = 2000;
web3.eth.transactionConfirmationBlocks = 12;

web3Provider.on('error', err => logger.error(`web3 error: ${err}`));
web3Provider.on('connect', () => logger.info('Blockchain Connected ...'));
web3Provider.on('end', () => logger.info('Blockchain disconnected'));

console.log('ENV', config.ENVIRONMENTS.localhost);
const app = express();

app.set('web3', web3);
app.set('keys', new Keys(PROPOSER_KEY, web3));

setupHttpDefaults(app, app => {
  app.use('/proposer', proposer);
  app.use('/contract-address', contracts);
});

app.use('/api-docs', swaggerUi.serve);

const apiDocs = YAML.parse(fs.readFileSync('./src/swagger.yaml', 'utf8'));
app.get('/api-docs', swaggerUi.setup(apiDocs));

app.listen(PROPOSER_PORT);

export default app;
