/**
 * @module index.js
 * @author iAmMichaelConnor
 * @desc index.js gives api endpoints to access the functions of the merkle-tree microservice */

import express, { Router } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import logger from './logger';
import Web3 from './web3';
import autostart from './auto-start';

import {
  assignDbConnection,
  formatResponse,
  formatError,
  errorHandler,
  logError,
} from './middleware';

import { leafRoutes, nodeRoutes, metadataRoutes, merkleTreeRoutes } from './routes';

Web3.connect();
const app = express();

// TODO: what is this? :
app.use(function cros(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  if (req.method === 'OPTIONS') {
    res.end();
  } else {
    next();
  }
});

// cors & body parser middleware should come before any routes are handled
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.use(assignDbConnection);

// Routes
const router = Router();
app.use(router);

leafRoutes(router);
nodeRoutes(router);
metadataRoutes(router);
merkleTreeRoutes(router);

// Response
app.use(formatResponse);
app.use(formatError);
app.use(errorHandler);
app.use(logError);

const server = app.listen(80, '0.0.0.0', () => {
  logger.info('merkle-tree RESTful API server started on ::: 80');
  if (process.env.AUTOSTART) autostart();
});
server.timeout = 0;
