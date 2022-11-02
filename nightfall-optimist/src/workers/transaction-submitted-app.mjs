/* eslint-disable no-await-in-loop */
// ignore unused exports default
/*
CONTRACT_ARTIFACTS=/tmp/nf/contracts/ NODE_CONFIG_DIR=../../../config BLOCKCHAIN_URL=ws://localhost:8546 node transaction-submitted-app.mjs 
*/

import express from 'express';
import cluster from 'cluster';
import config from 'config';
import os from 'os';
import axios from 'axios';
import fs from 'fs';

import { submitTransaction } from '../event-handlers/transaction-submitted.mjs';

const { txWorkerCount, txWorkerOptimistApiUrl } = config.TX_WORKER_PARAMS;

//  ip addr show docker0
async function initWorkers() {
  let shieldInterface;
  let challengesInterface;
  if (cluster.isPrimary) {
    // Contact with optimist and download Shield and Challenges jsons
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        shieldInterface = await axios.get(
          `${txWorkerOptimistApiUrl}/contract-abi/interface/Shield`,
          {
            timeout: 10000,
          },
        );
        challengesInterface = await axios.get(
          `${txWorkerOptimistApiUrl}/contract-abi/interface/Challenges`,
          {
            timeout: 10000,
          },
        );
        break;
      } catch (err) {
        console.log('Downloading contracts. Retrying...');
        await new Promise(resolve => setTimeout(() => resolve(), 5000)); // eslint-disable-line no-await-in-loop
      }
    }
    fs.writeFileSync(
      `${config.CONTRACT_ARTIFACTS}/Shield.json`,
      JSON.stringify(shieldInterface.data.interface, null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      `${config.CONTRACT_ARTIFACTS}/Challenges.json`,
      JSON.stringify(challengesInterface.data.interface, null, 2),
      'utf-8',
    );

    const totalCPUs = Math.min(os.cpus().length, txWorkerCount);

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
    console.log(`Worker ${process.pid} started`);

    app.get('/healthcheck', async (req, res) => {
      res.sendStatus(200);
    });

    app.get('/tx-submitted', async (req, res) => {
      const { tx, proposerFlag, enable } = req.query;
      try {
        const response = submitTransaction(
          JSON.parse(tx),
          proposerFlag === 'true',
          enable === 'true',
        );
        res.json(response);
      } catch (err) {
        res.sendStatus(500);
      }
    });
    app.listen(3000);
  }
}

initWorkers();

export default initWorkers;
