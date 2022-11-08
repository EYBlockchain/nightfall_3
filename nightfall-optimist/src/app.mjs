/* eslint no-shadow: "off" */

import express from 'express';
import config from 'config';
import { web3 } from '@polygon-nightfall/common-files/utils/contract.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
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

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
logger.debug(`********* Optimist environment vars ${JSON.stringify(environment)}`); // TODO review logs

const app = express();

const ethPrivateKey = environment.PROPOSER_KEY;
const { address } = web3.eth.accounts.privateKeyToAccount(ethPrivateKey);

app.set('ethPrivateKey', ethPrivateKey);
app.set('ethAddress', address);

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
  },
  true,
  false,
);

export default app;
