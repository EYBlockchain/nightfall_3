/* eslint no-shadow: "off" */

import express from 'express';
import { setupHttpDefaults } from 'common-files/utils/httputils.mjs';
import {
  deposit,
  getContractAddress,
  transfer,
  withdraw,
  finaliseWithdrawal,
  isValidWithdrawal,
  commitment,
  incomingViewingKey,
  setInstantWithdrawl,
  generateZkpKeys,
} from './routes/index.mjs';

const app = express();

setupHttpDefaults(
  app,
  app => {
    app.use('/deposit', deposit);
    app.use('/contract-address', getContractAddress);
    app.use('/transfer', transfer);
    app.use('/withdraw', withdraw);
    app.use('/finalise-withdrawal', finaliseWithdrawal);
    app.use('/valid-withdrawal', isValidWithdrawal);
    app.use('/commitment', commitment);
    app.use('/incoming-viewing-key', incomingViewingKey);
    app.use('/set-instant-withdrawal', setInstantWithdrawl);
    app.use('/generate-zkp-keys', generateZkpKeys);
  },
  true,
  false,
);

export default app;
