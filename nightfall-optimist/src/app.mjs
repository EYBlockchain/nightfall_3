/* eslint no-shadow: "off" */

import express from 'express';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import options from './swagger-options.mjs';

import {
  proposer,
  block,
  challenger,
  transaction,
  getContractAddress,
  getContractAbi,
  debug,
} from './routes/index.mjs';

const spec = swaggerJsDoc(options);

const app = express();

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
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
  },
  true,
  false,
);

export default app;
