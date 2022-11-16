/* eslint-disable no-await-in-loop */
// ignore unused exports default

import express from 'express';
import cluster from 'cluster';
import config from 'config';
import os from 'os';

import { submitTransaction } from '../event-handlers/transaction-submitted.mjs';

const { txWorkerCount } = config.TX_WORKER_PARAMS;

async function initWorkers() {
  if (cluster.isPrimary) {
    const totalCPUs = Math.min(os.cpus().length - 1, Number(txWorkerCount));

    console.log(`Number of CPUs is ${totalCPUs}`);

    // Fork workers.
    for (let i = 0; i < totalCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', worker => {
      console.log(`worker ${worker.process.pid} died`);
      console.log("Let's fork another worker!");
      cluster.fork();
    });
  } else {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    console.log(`Worker ${process.pid} started`);

    app.get('/healthcheck', async (req, res) => {
      res.sendStatus(200);
    });

    // End point to submit transaction to tx worker
    app.post('/tx-submitted', async (req, res) => {
      const { tx, proposerFlag } = req.body;
      try {
        submitTransaction(tx, proposerFlag, process.pid);
        res.sendStatus(200);
      } catch (err) {
        res.sendStatus(500);
      }
    });
    app.listen(3000);
  }
}

initWorkers();

export default initWorkers;
