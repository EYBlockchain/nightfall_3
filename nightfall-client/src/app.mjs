/* eslint no-shadow: "off" */

import express from 'express';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import {
  deposit,
  getContractAddress,
  getContractAbi,
  transfer,
  withdraw,
  finaliseWithdrawal,
  isValidWithdrawal,
  commitment,
  incomingViewingKey,
  setInstantWithdrawl,
  generateZkpKeys,
  kyc,
  tokenise,
  burn,
  manufacture,
} from './routes/index.mjs';

const app = express();

setupHttpDefaults(
  app,
  app => {
    app.use('/deposit', deposit);
    app.use('/contract-address', getContractAddress);
    app.use('/contract-abi', getContractAbi);
    app.use('/transfer', transfer);
    app.use('/withdraw', withdraw);
    app.use('/tokenise', tokenise);
    app.use('/burn', burn);
    app.use('/finalise-withdrawal', finaliseWithdrawal);
    app.use('/valid-withdrawal', isValidWithdrawal);
    app.use('/commitment', commitment);
    app.use('/incoming-viewing-key', incomingViewingKey);
    app.use('/set-instant-withdrawal', setInstantWithdrawl);
    app.use('/generate-zkp-keys', generateZkpKeys);
    app.use('/whitelist', kyc);
    app.use('/manufacture', manufacture);
  },
  true,
  false,
);

export default app;
