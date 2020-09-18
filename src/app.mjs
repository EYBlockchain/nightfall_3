import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import generateProof from './routes/generateProof.mjs';
import generateKeys from './routes/generateKeys.mjs';
import vk from './routes/vk.mjs';
import loadCircuit from './routes/loadCircuit.mjs';
import loadCircuits from './routes/loadCircuits.mjs';

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
