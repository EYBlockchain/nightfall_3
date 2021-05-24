/**
 * @module leaf.service.js
 * @author iAmMichaelConnor
 * @desc orchestrates inserts to and gets from the mongodb
 */

import { COLLECTIONS } from '../common/constants';
import { leafMapper } from '../mappers';
import logger from '../../logger';

export default class LeafService {
  constructor(_db) {
    this.db = _db;
  }

  // INSERTS

  /**
  Insert a new leaf into the merkle tree
  @param {number} treeHeight
  @param {object} leaf
  */
  async insertLeaf(treeHeight, leaf) {
    logger.silly(`data before mapping: ${JSON.stringify(leaf, null, 2)}`);
    logger.debug('src/db/service/leaf.service insertLeaf()');
    const mappedData = leafMapper(treeHeight, leaf);
    logger.silly(`data after mapping: ${JSON.stringify(mappedData, null, 2)}`);

    // insert the leaf into the 'nodes' collection:
    try {
      const dbResponse = await this.db.save(COLLECTIONS.NODE, mappedData);
      return dbResponse;
    } catch (err) {
      if (err.code === 11000) {
        logger.warn(
          'You may wish to ignore the above "DB Error" message. The record already exists. No overwrite has happened. This is acceptable.',
        );
        return false;
      }
      return Promise.reject(err);
    }
  }

  /**
  Insert many leaves into the merkle tree
  @param {number} treeHeight
  @param {array} leaves - an array of leaf objects ('documents')
  */
  async insertLeaves(treeHeight, leaves) {
    logger.debug('src/db/service/leaf.service insertLeaves()');
    logger.silly(`data before mapping: ${JSON.stringify(leaves, null, 2)}`);
    const mappedData = leaves.map(leaf => leafMapper(treeHeight, leaf));
    logger.silly(`data after mapping: ${JSON.stringify(mappedData, null, 2)}`);

    // insert the leaves into the 'nodes' collection:
    try {
      const dbResponse = await this.db.insertMany(COLLECTIONS.NODE, mappedData);
      return dbResponse;
    } catch (err) {
      if (err.code === 11000) {
        logger.warn(
          'You may wish to ignore the above "DB Error" message. The record already exists. No overwrite has happened. This is acceptable.',
        );
        return false;
      }
      return Promise.reject(err);
    }
  }

  // UPDATES

  // nothing here - leaves never change

  // GETTERS

  /**
  Get a single leaf by its leafIndex
  @param {number} leafIndex
  @returns {object} the leaf object
  */
  async getLeafByLeafIndex(leafIndex) {
    logger.debug('src/db/service/leaf.service getLeafByLeafIndex()');

    const doc = await this.db.getDoc(COLLECTIONS.NODE, {
      leafIndex,
    });

    return doc;
  }

  /**
  Get many leaves by their leafIndices
  @param {array} leafIndices
  @returns {array} an array of leaf objects
  */
  async getLeavesByLeafIndices(leafIndices) {
    logger.debug('src/db/service/leaf.service getLeavesByLeafIndices()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { leafIndex: { $in: leafIndices } },
      null, // don't filter the output
      { leafIndex: 1 }, // sort by leafIndex in ascending order
    );

    return docs;
  }

  /**
  Get all leaves within a range determined by their leafIndices
  @param {number} minIndex
  @param {number} maxIndex
  @returns {array} an array of leaf objects
  */
  async getLeavesByLeafIndexRange(minIndex, maxIndex) {
    logger.debug('src/db/service/leaf.service getLeavesByLeafIndexRange()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { leafIndex: { $gte: minIndex, $lte: maxIndex } },
      null, // don't filter the output
      { leafIndex: 1 }, // sort by leafIndex in ascending order
    );

    return docs;
  }

  /**
  Get a single leaf (or a set of leaves with duplicate values) by its value
  @param {string} value
  @returns {object} the leaf object(s)
  */
  async getLeafByValue(value) {
    logger.debug('src/db/service/leaf.service getLeafByValue()');

    const docs = await this.db.getDoc(COLLECTIONS.NODE, {
      value,
    });

    return docs;
  }

  /**
  Get many leaves by their values
  @param {array} values
  @returns {array} an array of leaf objects
  */
  async getLeavesByValues(values) {
    logger.debug('src/db/service/leaf.service getLeavesByValues()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { value: { $in: values } },
      null, // don't filter the output
      { leafIndex: 1 }, // sort by leafIndex in ascending order
    );

    return docs;
  }

  /**
  Get all leaves.
  @returns {array} an array of leaf objects
  */
  async getLeaves() {
    logger.debug('src/db/service/leaf.service getLeaves()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { leafIndex: { $exists: true } },
      null, // don't filter the output
      { leafIndex: 1 }, // sort by leafIndex in ascending order
    );

    return docs;
  }

  /**
  Get all leaf values. Exclude extra data.
  TODO: THIS MIGHT BE COMPUTATIONALLY IMPRACTICAL!!!
  @returns {array} an array of leaf values, in ascending order (by leafIndex)
  */
  async getLeafValues() {
    logger.debug('src/db/service/leaf.service getLeafValues()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { leafIndex: { $exists: true } }, // query
      ['leafIndex', 'value'], // output only these keys
      { leafIndex: 1 }, // sort by leafIndex in ascending order
    );

    return docs;
  }

  /**
  Get the leaf document for the latest leaf (i.e. the one with the max index)
  */
  async getLatestLeaf() {
    logger.debug('src/db/service/leaf.service getLatestLeaf()');

    // insert the leaf into the 'nodes' collection:
    const doc = await this.db.getDocs(
      COLLECTIONS.NODE,
      { leafIndex: { $exists: true } }, // query
      null, // projection (output only these keys)
      { leafIndex: -1 }, // sort by leafIndex in descending order (we'll then grab the top one),
      1, // limit to the 'top' (latest) result
    );

    return doc[0];
  }

  // OTHER

  /**
  Count the number of leaves stored in the merkle tree
  */
  async countLeaves() {
    logger.debug('src/db/service/leaf.service countLeaves()');

    const leafCount = await this.db.countDocuments(COLLECTIONS.NODE, {
      leafIndex: { $exists: true },
    });

    return leafCount;
  }

  /**
  Get the maximum leafIndex stored in the db
  */
  async maxLeafIndex() {
    logger.debug('src/db/service/leaf.service maxLeafIndex()');

    const doc = await this.db.getDocs(
      COLLECTIONS.NODE,
      { leafIndex: { $exists: true } }, // query
      { leafIndex: 1, _id: 0 }, // projection (output only these keys)
      { leafIndex: -1 }, // sort by leafIndex in descending order (we'll then grab the top one)
      1, // limit output to the 'top' (max) result
    );

    const { leafIndex } = doc[0] || {};

    return leafIndex;
  }

  async findMissingLeaves(startLeafIndex, endLeafIndex) {
    logger.debug('src/db/service/leaf.service findMissingLeaves()');

    const missingLeaves = await this.db.aggregate(
      COLLECTIONS.NODE,
      {
        leafIndex: { $exists: true },
      }, // query
      // stages:
      [
        {
          $sort: {
            leafIndex: 1, // sort by leafIndex in ascending order
          },
        },
        {
          $group: {
            _id: null, // group all documents into the same bucket
            leafIndices: { $push: '$leafIndex' }, // create an array of all   "leafIndex" fields
          },
        },
      ],

      // Find any expected values that are missing from the existing data
      {
        $project: {
          _id: 0, // remove the '_id' field
          missing: {
            $setDifference: [
              {
                $range: [startLeafIndex, endLeafIndex],
              }, // create an array of all numbers in this range
              '$leafIndices',
            ],
          },
        },
      },
    );

    // format of missingLeaves = [ { missing: [ 1, 4, 5, 6 ] } ]

    const { missing } = missingLeaves[0] || {};

    return missing;
  }
}
