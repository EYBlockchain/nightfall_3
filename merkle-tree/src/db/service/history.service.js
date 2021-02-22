/**
 * @module history.service.js
 * @author westlad
 * @desc orchestrates inserts to and gets from the mongodb related to history
 */

import { COLLECTIONS } from '../common/constants';
import logger from '../../logger';
import { historyMapper } from '../mappers';

export default class HistoryService {
  constructor(_db) {
    this.db = _db;
  }

  /**
  Saves the given root and associated frontier, leafIndex and block
  Added by Westlad
  */
  async saveTreeHistory({ root, oldRoot, frontier, leafIndex, currentLeafCount, blockNumber }) {
    logger.debug('src/db/service/metadata.service saveTreeHistory()');
    // insert the leaf into the 'nodes' collection:
    try {
      const dbResponse = await this.db.save(COLLECTIONS.HISTORY, {
        root,
        oldRoot,
        frontier,
        leafIndex,
        currentLeafCount,
        blockNumber,
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

  async deleteTreeHistory(_leafCount) {
    logger.debug('deleting alternative timeline');
    const leafCount = Number(_leafCount);
    return this.db.deleteMany(COLLECTIONS.HISTORY, { currentLeafCount: { $gte: leafCount } });
  }
}
