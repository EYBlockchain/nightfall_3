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
import swaggerJsDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nightfall Optmist API',
      version: '1.0.0',
      description: 'An api to be used by the proposers',
    },
    servers: [
      {
        url: 'http://localhost:8081',
      },
    ],
    apis: ['./routes/*.mjs'],
  },
};

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
