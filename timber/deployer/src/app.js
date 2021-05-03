/**
@module index.js
@desc setup express, establish routes and cors.
@author westlad
*/

import express, { Router } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import Web3 from './web3';
import deployerRoutes from './routes/deployer.routes';

const app = express();
Web3.connect();

// cors & body parser middleware should come before any routes are handled
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routes
const router = Router();
app.use(router);

deployerRoutes(router);

// handle bad calls
app.use((req, res) => {
  res.status(404).send({ url: `${req.originalUrl} not found` });
});

export default app;
