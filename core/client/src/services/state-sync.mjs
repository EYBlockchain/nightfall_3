/**
Resync code so that restarted client instances are able to read past events and update
their local commitments databsae.
*/

import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import blockProposedEventHandler from '../event-handlers/block-proposed.mjs';
import rollbackEventHandler from '../event-handlers/rollback.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION, STATE_CONTRACT_NAME } = config;

const syncState = async (fromBlock = 'earliest', toBlock = 'latest', eventFilter = 'allEvents') => {
  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME); // Rollback, BlockProposed

  const pastStateEvents = await stateContractInstance.getPastEvents(eventFilter, {
    fromBlock,
    toBlock,
  });

  for (let i = 0; i < pastStateEvents.length; i++) {
    switch (pastStateEvents[i].event) {
      case 'BlockProposed':
        // eslint-disable-next-line no-await-in-loop
        await blockProposedEventHandler(pastStateEvents[i]);
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

// eslint-disable-next-line import/prefer-default-export
export const initialClientSync = async () => {
  const allCommitments = await genGetCommitments();
  const commitmentBlockNumbers = allCommitments.map(a => a.blockNumber).filter(n => n >= 0);
  logger.info(`commitmentBlockNumbers: ${commitmentBlockNumbers}`);
  const firstSeenBlockNumber = Math.min(...commitmentBlockNumbers);
  logger.info(`firstSeenBlockNumber: ${firstSeenBlockNumber}`);
  // fistSeenBlockNumber can be infinity if the commitmentBlockNumbers array is empty
  if (firstSeenBlockNumber === Infinity) return syncState();
  return syncState(firstSeenBlockNumber);
};
