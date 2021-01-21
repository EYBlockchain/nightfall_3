/**
 * @module metadata.service.js
 * @author westlad
 * @desc orchestrates inserts to and gets from the mongodb
 */

import { COLLECTIONS } from '../common/constants';
import logger from '../../logger';

export default class HistoryService {
  constructor(_db) {
    this.db = _db;
  }

  /**
  Saves the given root and associated frontier, leafIndex and block
  Added by Westlad
  */
  async saveTreeHistory({ root, frontier, leafIndex, blockNumber }) {
    logger.debug('src/db/service/metadata.service InsertTreeHistory()');
    // insert the leaf into the 'nodes' collection:
    try {
      const dbResponse = await this.db.save(COLLECTIONS.HISTORY, {
        root,
        frontier,
        leafIndex,
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
    return docs;
  }
}
