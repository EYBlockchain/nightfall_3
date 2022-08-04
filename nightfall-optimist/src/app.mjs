import express from 'express';
import {
  proposer,
  block,
  challenger,
  transaction,
  getContractAddress,
  debug,
} from './routes/index.mjs';
import { setupHttpDefaults } from 'common-files/utils/httputils.mjs';

const app = express();

setupHttpDefaults(app, app => {
  app.use('/proposer', proposer);
  app.use('/block', block);
  app.use('/challenger', challenger);
  app.use('/transaction', transaction);
  app.use('/contract-address', getContractAddress);
  app.use('/debug', debug);
}, true, true);

export default app;
