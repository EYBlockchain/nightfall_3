/**
 * @module history.service.js
 * @author westlad
 * @desc orchestrates inserts to and gets from the mongodb related to history
 */

import { COLLECTIONS } from '../common/constants.mjs';
import logger from '../../logger.mjs';
import { historyMapper } from '../mappers/index.mjs';

export default class HistoryService {
  constructor(_db) {
    this.db = _db;
  }

  /**
  Saves the given root and associated frontier, leafIndex and block
  Added by Westlad
  */
  async saveTreeHistory({
    root,
    oldRoot,
    frontier,
    leafIndex,
    currentLeafCount,
    blockNumber,
    transactionHash,
  }) {
    logger.debug('src/db/service/history.service saveTreeHistory()');
    // insert the leaf into the 'nodes' collection:
    try {
      const dbResponse = await this.db.save(COLLECTIONS.HISTORY, {
        root,
        oldRoot,
        frontier,
        leafIndex,
        currentLeafCount,
        blockNumber,
        transactionHash,
      });
      return dbResponse;
    } catch (err) {
      logger.error(err);
      return Promise.reject(err);
    }
  }

  async getTreeHistory(root) {
    logger.debug('src/db/service/metadata.service getTreeHistory()');
    const docs = await this.db.getDoc(COLLECTIONS.HISTORY, {
      root,
    });
    return historyMapper(docs);
  }

  async getTreeHistoryByCurrentLeafCount(currentLeafCount) {
    logger.debug(
      `src/db/service/history.service getTreeHistoryByCurrentLeafCount(${currentLeafCount})`,
    );
    const docs = await this.db.getDoc(COLLECTIONS.HISTORY, {
      currentLeafCount,
    });
    return historyMapper(docs);
  }

  async getTreeHistoryByTransactionHash(transactionHash) {
    logger.debug(
      `src/db/service/history.service getTreeHistoryByTransactionHash(${transactionHash})`,
    );
    const docs = await this.db.getDoc(COLLECTIONS.HISTORY, {
      transactionHash,
    });
    return historyMapper(docs);
  }

  async deleteTreeHistory(_leafCount) {
    logger.debug('deleting alternative timeline');
    const leafCount = Number(_leafCount);
    return this.db.deleteMany(COLLECTIONS.HISTORY, { currentLeafCount: { $gte: leafCount } });
  }
}
