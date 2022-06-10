/* ignore unused exports */
import express from 'express';
import bodyParser from 'body-parser';
import config from 'config';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { proposer, contracts } from './routes/index.mjs';
import startProposer from './proposer.mjs';
import Nf3 from '../../../cli/lib/nf3.mjs';

const { SIGNING_KEY, PROPOSER_PORT } = config;
const environment = {
  clientApiUrl: `http://${config.CLIENT_HOST}:${config.CLIENT_PORT}`,
  optimistApiUrl: `http://${config.OPTIMIST_HOST}:${config.OPTIMIST_PORT}`,
  optimistWsUrl: `ws://${config.OPTIMIST_HOST}:${config.OPTIMIST_WS_PORT}`,
  web3WsUrl: `ws://${config.BLOCKCHAIN_WS_HOST}:${config.BLOCKCHAIN_PORT}`,
  proposerBaseUrl: `http://${process.env.PROPOSER_HOST}:${process.env.PROPOSER_PORT}`,
};

const app = express();
const nf3 = new Nf3(SIGNING_KEY, environment);

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
app.use('/proposer', proposer);
app.use('/contract-address', contracts);
app.listen(PROPOSER_PORT);

startProposer(nf3);

export default app;
