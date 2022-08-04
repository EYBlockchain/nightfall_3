import express from 'express';
import generateProof from './routes/generateProof.mjs';
import generateKeys from './routes/generateKeys.mjs';
import vk from './routes/vk.mjs';
import loadCircuits from './routes/loadCircuits.mjs';
import verify from './routes/verify.mjs';
import { setupHttpDefaults } from 'common-files/utils/httputils.mjs';

const app = express();

setupHttpDefaults(app, app => {
  app.use('/generate-keys', generateKeys);
  app.use('/generate-proof', generateProof);
  app.use('/vk', vk);
  app.use('/load-circuits', loadCircuits);
  app.use('/verify', verify);
}, true, true);

export default app;
