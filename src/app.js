import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import generateProof from './routes/generateProof.js';
import generateKeys from './routes/generateKeys.js';
import vk from './routes/vk.js';
import loadCircuit from './routes/loadCircuit.js';
import loadCircuits from './routes/loadCircuits.js';

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));
app.use(
  fileUpload({
    createParentPath: true,
  }),
);

app.get('/healthcheck', (req, res) => res.sendStatus(200));
app.use('/generate-keys', generateKeys);
app.use('/generate-proof', generateProof);
app.use('/vk', vk);
app.use('/load-circuit', loadCircuit);
app.use('/load-circuits', loadCircuits);

export default app;
