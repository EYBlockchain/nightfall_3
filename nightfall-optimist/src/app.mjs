/* eslint no-shadow: "off" */

import express from 'express';
import config from 'config';
import { web3 } from '@polygon-nightfall/common-files/utils/contract.mjs';
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

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const app = express();

const ethPrivateKey = environment.PROPOSER_KEY;
const { address } = web3.eth.accounts.privateKeyToAccount(ethPrivateKey);

app.set('ethPrivateKey', ethPrivateKey);
app.set('ethAddress', address);

const spec = swaggerJsDoc(options);
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
