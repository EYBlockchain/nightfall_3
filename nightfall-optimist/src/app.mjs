/* eslint no-shadow: "off" */

import express from 'express';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import Web3 from '@polygon-nightfall/common-files/utils/web3.mjs';
import {
  proposer,
  block,
  challenger,
  transaction,
  getContractAddress,
  getContractAbi,
  debug,
} from './routes/index.mjs';

const app = express();

const web3Websocket = Web3.connection();
const ethAddress = config.ETH_ADDRESS;
const ethPrivateKey = config.ETH_PRIVATE_KEY;
logger.debug(`********* ethAddress ${ethAddress}`); // TODO rm, rm import

app.set('web3Websocket', web3Websocket);
app.set('ethAddress', ethAddress);
app.set('ethPrivateKey', ethPrivateKey);

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
