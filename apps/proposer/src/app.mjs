/* ignore unused exports */
/* eslint no-shadow: "off" */
/* eslint import/no-unresolved: "off" */

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import config from 'config';
import YAML from 'yaml';
import fs from 'fs';
import { setupHttpDefaults } from '../common-files/utils/httputils.mjs';
import proposer from './routes/index.mjs';

const PROPOSER_PORT = process.env.PROPOSER_PORT || 80;

console.log('ENV', config.ENVIRONMENTS[process.env.ENVIRONMENT]);
const app = express();

setupHttpDefaults(app, app => {
  app.use('/proposer', proposer);
});

app.use('/api-docs', swaggerUi.serve);

const apiDocs = YAML.parse(fs.readFileSync('./src/swagger.yaml', 'utf8'));
app.get('/api-docs', swaggerUi.setup(apiDocs));

app.listen(PROPOSER_PORT);

export default app;
