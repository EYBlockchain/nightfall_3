import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import {
  proposer,
  block,
  challenger,
  transaction,
  getContractAddress,
  getContractAbi,
  debug,
} from './routes/index.mjs';

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));

app.get('/healthcheck', (req, res) => res.sendStatus(200));
app.use('/proposer', proposer);
app.use('/block', block);
app.use('/challenger', challenger);
app.use('/transaction', transaction);
app.use('/contract-address', getContractAddress);
app.use('/contract-abi', getContractAbi);
app.use('/debug', debug);

export default app;
