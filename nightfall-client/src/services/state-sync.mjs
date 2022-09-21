/* eslint-disable import/no-cycle */
/**
Resync code so that restarted client instances are able to read past events and update
their local commitments databsae.
*/

import axios from 'axios';
import fs from 'fs';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';
import downloadFile from 'common-files/utils/httputils.mjs';
import { unpauseQueue } from 'common-files/utils/event-queue.mjs';
import constants from 'common-files/constants/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import rollbackEventHandler from '../event-handlers/rollback.mjs';

const { STATE_CONTRACT_NAME } = constants;
const {
  MONGO_URL,
  COMMITMENTS_DB,
  COMMITMENTS_COLLECTION,
  CONTRACT_ARTIFACTS,
  STATE_GENESIS_BLOCK,
  DEPLOYMENT_FILES_URL: { DEFAULT_CONTRACT_FILES_URL },
} = config;

const { ETH_NETWORK, CONTRACT_FILES_URL } = process.env;

export const syncState = async (
  fromBlock = 'earliest',
  toBlock = 'latest',
  eventFilter = 'allEvents',
) => {
  logger.info({ msg: 'SyncState parameters', fromBlock, toBlock, eventFilter });

  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME); // Rollback, BlockProposed

  const pastStateEvents = await stateContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });

  for (let i = 0; i < pastStateEvents.length; i++) {
    switch (pastStateEvents[i].event) {
      case 'BlockProposed':
        // eslint-disable-next-line no-await-in-loop
        await blockProposedEventHandler(pastStateEvents[i], true);
        break;
      case 'Rollback':
        // eslint-disable-next-line no-await-in-loop
        await rollbackEventHandler(pastStateEvents[i]);
        break;
      default:
        break;
    }
  }
};

const genGetCommitments = async (query = {}, proj = {}) => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).find(query, proj).toArray();
};

const checkContractsABI = async () => {
  let env;
  switch (ETH_NETWORK) {
    case 'goerli':
      env = 'testnet';
      break;
    case 'mainnet':
      env = 'production';
      break;
    default:
      env = '';
  }

  if (env) {
    const baseUrl = CONTRACT_FILES_URL
      ? `${CONTRACT_FILES_URL}`
      : `${DEFAULT_CONTRACT_FILES_URL}/${env}`;
    const url = `${baseUrl}/build/hash.txt`;

    const res = await axios.get(url); // get all json abi contracts
    const files = res.data.split('\n');

    if (!fs.existsSync(`${CONTRACT_ARTIFACTS}`)) {
      fs.mkdirSync(`${CONTRACT_ARTIFACTS}`);
    }

    logger.info(`Downloading contracts from ${url}...`);

    await Promise.all(
      files.map(async f => {
        if (f) {
          try {
            await downloadFile(
              `${baseUrl}/build/contracts/${f.split('  ')[1]}`,
              `${CONTRACT_ARTIFACTS}/${f.split('  ')[1]}`,
            );
          } catch (e) {
            console.error(`ERROR downloading ${f.split('  ')[1]}`);
          }
        }
      }),
    );
    logger.info(`Contracts downloaded`);
  }
};

// eslint-disable-next-line import/prefer-default-export
export const initialClientSync = async () => {
  await checkContractsABI();
  const allCommitments = await genGetCommitments();
  const commitmentBlockNumbers = allCommitments.map(a => a.blockNumber).filter(n => n >= 0);

  logger.info(`commitmentBlockNumbers: ${commitmentBlockNumbers}`);

  const firstSeenBlockNumber = Math.min(...commitmentBlockNumbers);

  logger.info(`firstSeenBlockNumber: ${firstSeenBlockNumber}`);

  // fistSeenBlockNumber can be infinity if the commitmentBlockNumbers array is empty
  if (firstSeenBlockNumber === Infinity) {
    await syncState(STATE_GENESIS_BLOCK);
  } else {
    await syncState(firstSeenBlockNumber);
  }

  unpauseQueue(0); // the queues are paused to start with, so get them going once we are synced
  unpauseQueue(1);
};
