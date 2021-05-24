/**
 * @module metadata.service.js
 * @author iAmMichaelConnor
 * @desc orchestrates inserts to and gets from the mongodb
 */

import { COLLECTIONS } from '../common/constants';
import { metadataMapper } from '../mappers';
import logger from '../../logger';

export default class MetadataService {
  constructor(_db) {
    this.db = _db;
  }

  // INSERTS

  /**
  Insert a contractAddress into the tree's metadata
  @param {object} data
  */
  async insertContractAddress(data) {
    logger.debug('src/db/service/metadata.service insertContractAddress()');
    const { contractAddress } = metadataMapper(data);
    if (contractAddress === undefined) return null;

    const dbResponse = await this.db.updateDoc(
      COLLECTIONS.METADATA,
      { _id: 1 },
      { $set: { contractAddress } },
      { upsert: true },
    );

    return dbResponse;
  }

  /**
  Insert a contractInterface into the tree's metadata
  @param {object} data
  */
  async insertContractInterface(data) {
    logger.debug('src/db/service/metadata.service insertContractInterface()');
    const { contractInterface } = metadataMapper(data);
    if (contractInterface === undefined) return null;

    const dbResponse = await this.db.updateDoc(
      COLLECTIONS.METADATA,
      { _id: 1 },
      { $set: { contractInterface } },
      { upsert: true },
    );

    return dbResponse;
  }

  /**
  Get the treeHeight relating to the MerkleTree contract & treeId
  @returns {object} the { treeHeight }
  */
  async getTreeHeight() {
    logger.debug('src/db/service/metadata.service getTreeHeight()');

    let doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['treeHeight', '-_id'], // return only the 'treeHeight' key (and exclude the _id key)
    );
    doc = doc || {};
    return doc;
  }

  /**
  Insert a tree height into the tree's metadata
  @param {object} data
  */
  async insertTreeHeight(data) {
    logger.debug('src/db/service/metadata.service insertTreeHeight()');

    // TODO: although a check is done within the filter-controller to prevent treeHeight overwrites, users who call the API endpoint aren't protected unless we have code here. Unfortunately, this strong error-throwing code is too disruptive. Handle more intelligently, like the filter does.
    // const { treeHeight: checkTreeHeight } = await this.getTreeHeight();
    // if (checkTreeHeight)
    //   throw new Error(`treeHeight already set at ${checkTreeHeight}. This cannot be edited.`);

    const { treeHeight } = metadataMapper(data);
    if (treeHeight === undefined) return null;
    logger.debug(`treeHeight: ${treeHeight}`);

    const dbResponse = await this.db.updateDoc(
      COLLECTIONS.METADATA,
      { _id: 1 },
      { $set: { treeHeight } },
      { upsert: true },
    );

    return dbResponse;
  }

  // UPDATES

  /**
  Update the latestLeaf object in the tree's metadata
  @param {object} data
  */
  async updateLatestLeaf(data) {
    logger.debug('src/db/service/metadata.service updateLatestLeaf()');
    logger.silly(`data before mapping: ${JSON.stringify(data, null, 2)}`);
    const mappedData = metadataMapper(data);
    logger.silly(`data after mapping: ${JSON.stringify(mappedData, null, 2)}`);

    const { latestLeaf } = mappedData;
    logger.debug('latestLeaf:', latestLeaf);
    if (latestLeaf === undefined) return null;

    const doc = await this.db.updateDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      { $set: { latestLeaf } },
      // { upsert: false }, // we only ever want 1 'tree' document, so don't want to upsert
    );

    return doc;
  }

  /**
  Update the latestRecalculation object in the tree's metadata
  @param {object} data
  */
  async updateLatestRecalculation(data) {
    logger.debug('src/db/service/metadata.service updateLatestRecalculation()');
    logger.silly(`data before mapping: ${JSON.stringify(data, null, 2)}`);
    const mappedData = metadataMapper(data);
    logger.silly(`data after mapping: ${JSON.stringify(mappedData, null, 2)}`);

    const { latestRecalculation } = mappedData;
    logger.silly(`latestRecalculation: ${JSON.stringify(latestRecalculation, null, 2)}`);
    if (latestRecalculation === undefined) return null;

    const doc = await this.db.updateDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      { $set: { latestRecalculation } },
    );

    return doc;
  }

  /**
  Get all metadata for the tree
  @returns {object} the tree metadata object
  */
  async getMetadata() {
    logger.debug('src/db/service/metadata.service getMetadata()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
    );

    return doc;
  }

  /**
  Get the contractAddress relating to MerkleTree contract
  @returns {object} the { contractAddress }
  */
  async getContractAddress() {
    logger.debug('src/db/service/metadata.service getContractAddress()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['contractAddress', '-_id'], // return only the 'contractAddress' key (and exclude the _id key)
    );

    return doc;
  }

  /**
  Get the contractInterface relating to the MerkleTree contract
  @returns {object} the { contractInterface }
  */
  async getContractInterface() {
    logger.debug('src/db/service/metadata.service getContractInterface()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['contractInterface', '-_id'], // return only the 'contractInterface' key (and exclude the _id key)
    );

    let { contractInterface } = doc;

    contractInterface = {
      contractInterface: JSON.parse(contractInterface),
    };

    return contractInterface;
  }

  /**
  Get the latestRecalculation metadata for the tree
  @returns {object} the latestRecalculation object
  */
  async getLatestRecalculation() {
    logger.debug('src/db/service/metadata.service getLatestRecalculation()');

    let doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['latestRecalculation', '-_id'], // return only the 'latestRecalculation' key (and exclude the _id key)
    );
    doc = doc || {};

    return doc;
  }

  /**
  Get the latestLeaf metadata for the tree
  @returns {object} the latestLeaf object
  */
  async getLatestLeaf() {
    logger.debug('src/db/service/metadata.service getLatestLeaf()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document),
      ['latestLeaf', '-_id'], // return only the 'latestLeaf' key (and exclude the _id key)
    );

    return doc;
  }
}
