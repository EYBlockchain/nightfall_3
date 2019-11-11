/**
 * @module metadata.service.js
 * @author iAmMichaelConnor
 * @desc orchestrates inserts to and gets from the mongodb
 */

import { COLLECTIONS } from '../common/constants';
import { metadataMapper } from '../mappers';

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
    console.log('\nsrc/db/service/metadata.service insertContractAddress()');
    const { contractAddress } = metadataMapper(data);

    const dbResponse = await this.db.save(COLLECTIONS.METADATA, { _id: 1, contractAddress });

    return dbResponse;
  }

  // UPDATES

  /**
  Update the latestLeaf object in the tree's metadata
  @param {object} data
  */
  async updateLatestLeaf(data) {
    console.log('\nsrc/db/service/metadata.service updateLatestLeaf()');
    // console.log('data before mapping:', data);
    const mappedData = metadataMapper(data);
    // console.log('data after mapping:', mappedData);

    const { latestLeaf } = mappedData;

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
    console.log('\nsrc/db/service/metadata.service updateLatestRecalculation()');
    // console.log('data before mapping:', data);
    const mappedData = metadataMapper(data);
    // console.log('data after mapping:', mappedData);

    const { latestRecalculation } = mappedData;

    const doc = await this.db.updateDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      { $set: { latestRecalculation } },
      // { upsert: false }, // we only ever want 1 'tree' document, so don't want to upsert
    );

    return doc;
  }

  /**
  Get all metadata for the tree
  @returns {object} the tree metadata object
  */
  async getMetadata() {
    console.log('\nsrc/db/service/metadata.service getMetadata()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
    );

    return doc;
  }

  /**
  Get the latestRecalculation metadata for the tree
  @returns {object} the latestRecalculation object
  */
  async getContractAddress() {
    console.log('\nsrc/db/service/metadata.service getContractAddress()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['contractAddress', '-_id'], // return only the 'contractAddress' key (and exclude the _id key)
    );

    return doc;
  }

  /**
  Get the latestRecalculation metadata for the tree
  @returns {object} the latestRecalculation object
  */
  async getLatestRecalculation() {
    console.log('\nsrc/db/service/metadata.service getLatestRecalculation()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['latestRecalculation', '-_id'], // return only the 'latestRecalculation' key (and exclude the _id key)
    );

    return doc;
  }

  /**
  Get the latestLeaf metadata for the tree
  @returns {object} the latestLeaf object
  */
  async getLatestLeaf() {
    console.log('\nsrc/db/service/metadata.service getLatestLeaf()');

    const doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document),
      ['latestLeaf', '-_id'], // return only the 'latestLeaf' key (and exclude the _id key)
    );

    return doc;
  }
}
