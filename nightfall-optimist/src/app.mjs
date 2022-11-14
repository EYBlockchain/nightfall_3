/* eslint no-shadow: "off" */

import express from 'express';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import passport from 'passport';
import { Strategy } from 'passport-http-header-strategy';
import {
  proposer,
  block,
  challenger,
  transaction,
  getContractAddress,
  getContractAbi,
  debug,
} from './routes/index.mjs';

passport.use(
  new Strategy({ header: 'X-APP-TOKEN', passReqToCallback: true }, (req, token, done) =>
    done(null, token === process.env.AUTH_TOKEN),
  ),
);

const app = express();

app.use(passport.initialize());
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
