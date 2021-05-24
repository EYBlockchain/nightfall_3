import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import {
  generateZkpKey,
  deposit,
  getContractAddress,
  transfer,
  withdraw,
  isMessageValid,
  finaliseWithdrawal,
} from './routes/index.mjs';

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));

app.get('/healthcheck', (req, res) => res.sendStatus(200));
app.use('/generate-zkp-key', generateZkpKey);
app.use('/deposit', deposit);
app.use('/contract-address', getContractAddress);
app.use('/transfer', transfer);
app.use('/withdraw', withdraw);
app.use('/check-message', isMessageValid);
app.use('/finalise-withdrawal', finaliseWithdrawal);

export default app;
