/* ignore unused exports */
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
import startChallenger from './challenger.mjs';

const { signingKeys } = config.TEST_OPTIONS;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const { CHALLENGER_PORT } = process.env;

const nf3 = new Nf3(signingKeys.challenger, environment);

const app = express();
app.set('nf3', nf3);
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));
app.use(
  fileUpload({
    createParentPath: true,
  }),
);

app.get('/healthcheck', (req, res) => res.sendStatus(200));
app.listen(CHALLENGER_PORT);

startChallenger(nf3);

export default app;
