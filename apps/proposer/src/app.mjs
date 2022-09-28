/* ignore unused exports */
/* eslint no-shadow: "off" */
/* eslint import/no-unresolved: "off" */

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import config from 'config';
import YAML from 'yaml';
import fs from 'fs';
import { setupHttpDefaults } from '../common-files/utils/httputils.mjs';
import { proposer, contracts } from './routes/index.mjs';
import startProposer from './proposer.mjs';
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

app.use('/api-docs', swaggerUi.serve);

const apiDocs = YAML.parse(fs.readFileSync('./src/swagger.yaml', 'utf8'));
app.get('/api-docs', swaggerUi.setup(apiDocs));

app.listen(PROPOSER_PORT);

startProposer(nf3, environment.proposerBaseUrl);

export default app;
