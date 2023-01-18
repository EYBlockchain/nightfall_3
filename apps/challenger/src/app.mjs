/* ignore unused exports */
/* eslint no-shadow: "off" */
/* eslint-disable import/no-unresolved */

import express from 'express';
import config from 'config';
import { setupHttpDefaults } from '@polygon-nightfall/common-files/utils/httputils.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import startChallenger from './challenger.mjs';

const CHALLENGER_PORT = process.env.CHALLENGER_PORT || 8192;

const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

const app = express();
const nf3 = new Nf3(environment.CHALLENGER_KEY, environment);

app.set('nf3', nf3);

setupHttpDefaults(app);

app.listen(CHALLENGER_PORT);

startChallenger(nf3);

export default app;
