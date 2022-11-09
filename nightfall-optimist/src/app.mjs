/* eslint no-shadow: "off" */

import express from 'express';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import {
  proposer,
  block,
  challenger,
  transaction,
  getContractAddress,
  getContractAbi,
  debug,
} from './routes/index.mjs';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';

const app = express();
const swaggerOutputJson = readFileSync('swagger-output.json', {
  encoding: 'utf8',
  flag: 'r',
});

setupHttpDefaults(
  app,
  app => {
    app.use('/proposer', proposer);
    app.use('/block', block);
    app.use('/challenger', challenger);
    app.use('/transaction', transaction);
    app.use('/contract-address', getContractAddress);
    app.use('/contract-abi', getContractAbi);
    app.use('/debug', debug);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(JSON.parse(swaggerOutputJson)));
  },
  true,
  false,
);

export default app;
