/* ignore unused exports */
/* eslint no-shadow: "off" */
/* eslint import/no-unresolved: "off" */

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import config from 'config';
import YAML from 'yaml';
import fs from 'fs';
import { setupHttpDefaults } from '../common-files/utils/httputils.mjs';
import { proposer, transaction } from './routes/index.mjs';
import WSocket from './classes/webSocket.mjs';

const PROPOSER_PORT = process.env.PROPOSER_PORT || 80;

console.log('ENV', config.ENVIRONMENTS[process.env.ENVIRONMENT]);
const app = express();

setupHttpDefaults(app, app => {
  app.use('/proposer', proposer);
  app.use('/transaction', transaction);
});

app.use('/api-docs', swaggerUi.serve);

const apiDocs = YAML.parse(fs.readFileSync('./src/swagger.yaml', 'utf8'));
app.get('/api-docs', swaggerUi.setup(apiDocs));

// eslint-disable-next-line no-unused-vars
const socket = new WSocket();
app.listen(PROPOSER_PORT);

export default app;
