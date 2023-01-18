/* ignore unused exports */
/* eslint no-shadow: "off" */
/* eslint import/no-unresolved: "off" */

/*
 @deprecated This file will be removed soon. Please, don't add changes to it.
*/

import config from 'config';
import startProposer from './proposer.mjs';
import Nf3 from '../cli/lib/nf3.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const nf3 = new Nf3(environment.PROPOSER_KEY, environment);
nf3.setApiKey(environment.AUTH_TOKEN);

startProposer(nf3, environment.optimistApiUrl);
