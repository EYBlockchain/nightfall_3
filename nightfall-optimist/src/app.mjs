/* eslint no-shadow: "off" */

import express from 'express';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import {
  proposer,
  block,
  challenger,
  transaction,
  getContractAddress,
  getContractAbi,
  debug,
} from './routes/index.mjs';
import config from 'config';

const { optimistApiUrl } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

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
        url: `${optimistApiUrl}`,
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          name: 'X-API-KEY',
          in: 'header',
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'API key is missing or invalid',
          headers: {
            WWW_Authenticate: {
              schema: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  apis: ['src/routes/**/*.mjs'],
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
