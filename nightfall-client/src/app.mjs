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
  x509,
  tokenise,
  burn,
  transform,
  regulator,
} from './routes/index.mjs';

const app = express();

// Add check for syncing state. If it is in syncing state, just respond 400
app.use((req, res, next) => {
  if (req.app.get('isSyncing')) {
    res.sendStatus(400);
    return res.status;
  }
  return next();
});
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
    app.use('/transform', transform);
    app.use('/finalise-withdrawal', finaliseWithdrawal);
    app.use('/valid-withdrawal', isValidWithdrawal);
    app.use('/commitment', commitment);
    app.use('/incoming-viewing-key', incomingViewingKey);
    app.use('/set-instant-withdrawal', setInstantWithdrawl);
    app.use('/generate-zkp-keys', generateZkpKeys);
    app.use('/x509', x509);
    app.use('/regulator', regulator);
  },
  true,
  false,
);

export default app;
