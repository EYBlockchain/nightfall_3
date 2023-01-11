/* eslint-disable import/no-cycle */
/**
Resync code so that restarted client instances are able to read past events and update
their local commitments databsae.
*/

import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import { checkContractsABI } from '@polygon-nightfall/common-files/utils/sync-files.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { unpauseQueue } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import rollbackEventHandler from '../event-handlers/rollback.mjs';

const { STATE_CONTRACT_NAME, CHALLENGES_CONTRACT_NAME } = constants;
const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION, STATE_GENESIS_BLOCK } = config;

export const syncState = async (
  fromBlock = 'earliest',
  toBlock = 'latest',
  eventFilter = 'allEvents',
) => {
  logger.info({ msg: 'SyncState parameters', fromBlock, toBlock, eventFilter });

  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME); // BlockProposed
  const challengesContractInstance = await waitForContract(CHALLENGES_CONTRACT_NAME); // Rollback

  const pastStateEvents = await stateContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });

  const pastChallengeEvents = await challengesContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });

  // Put all events together and sort chronologically as they appear on Ethereum
  const splicedList = pastStateEvents
    .concat(pastChallengeEvents)
    .sort((a, b) => a.blockNumber - b.blockNumber);

  for (let i = 0; i < splicedList.length; i++) {
    const pastEvent = splicedList[i];
    switch (pastEvent.event) {
      case 'BlockProposed':
        // eslint-disable-next-line no-await-in-loop
        await blockProposedEventHandler(pastEvent, true);
        break;
      case 'Rollback':
        // eslint-disable-next-line no-await-in-loop
        await rollbackEventHandler(pastEvent);
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
