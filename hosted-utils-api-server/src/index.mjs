import express from 'express';

// router will only have single get api, hence name prefixed with 'get'
import getCircuitsFromAWS from './routes/browser-circuit.mjs';

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
app.use(express.static('public')); // serves proving key
app.use('/browser-circuit', getCircuitsFromAWS);

app.listen(80);
