import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import {
  deposit,
  getContractAddress,
  transfer,
  withdraw,
  finaliseWithdrawal,
  isValidWithdrawal,
  commitment,
  incomingViewingKey,
  setInstantWithdrawl,
  generateZkpKeys,
  tokenise,
  manufacture,
} from './routes/index.mjs';

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));

app.use('/deposit', deposit);
app.use('/contract-address', getContractAddress);
app.use('/transfer', transfer);
app.use('/withdraw', withdraw);
app.use('/finalise-withdrawal', finaliseWithdrawal);
app.use('/valid-withdrawal', isValidWithdrawal);
app.use('/commitment', commitment);
app.use('/incoming-viewing-key', incomingViewingKey);
app.use('/set-instant-withdrawal', setInstantWithdrawl);
app.use('/generate-zkp-keys', generateZkpKeys);
app.use('/tokenise', tokenise);
app.use('/manufacture', manufacture);

export default app;
