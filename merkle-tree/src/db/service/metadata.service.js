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
    console.log('\nsrc/db/service/metadata.service insertContractInterface()');
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
  Insert a tree height into the tree's metadata
  @param {object} data
  */
  async insertTreeHeight(data) {
    console.log('\nsrc/db/service/metadata.service insertTreeHeight()');
    const { treeHeight } = metadataMapper(data);
    if (treeHeight === undefined) return null;
    console.log(`treeHeight: ${treeHeight}`);

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
    console.log('\nsrc/db/service/metadata.service updateLatestLeaf()');
    // console.log('\ndata before mapping:', data);
    const mappedData = metadataMapper(data);
    // console.log('\ndata after mapping:', mappedData);

    const { latestLeaf } = mappedData;
    console.log('latestLeaf:', latestLeaf);
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
    console.log('\nsrc/db/service/metadata.service updateLatestRecalculation()');
    // console.log('\ndata before mapping:', data);
    const mappedData = metadataMapper(data);
    // console.log('\ndata after mapping:', mappedData);

    const { latestRecalculation } = mappedData;
    console.log('latestRecalculation:', latestRecalculation);
    if (latestRecalculation === undefined) return null;

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
  Get the contractAddress relating to MerkleTree contract
  @returns {object} the { contractAddress }
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
  Get the contractInterface relating to the MerkleTree contract
  @returns {object} the { contractInterface }
  */
  async getContractInterface() {
    console.log('\nsrc/db/service/metadata.service getContractInterface()');

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
  Get the treeHeight relating to the MerkleTree contract & treeId
  @returns {object} the { treeHeight }
  */
  async getTreeHeight() {
    console.log('\nsrc/db/service/metadata.service getTreeHeight()');

    let doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['treeHeight', '-_id'], // return only the 'treeHeight' key (and exclude the _id key)
    );
    doc = doc || {};
    return doc;
  }

  /**
  Get the latestRecalculation metadata for the tree
  @returns {object} the latestRecalculation object
  */
  async getLatestRecalculation() {
    console.log('\nsrc/db/service/metadata.service getLatestRecalculation()');

    let doc = await this.db.getDoc(
      COLLECTIONS.METADATA,
      { _id: 1 }, // 'match all' (within our one document)
      ['latestRecalculation', '-_id'], // return only the 'latestRecalculation' key (and exclude the _id key)
    );
    doc = doc || {};

    doc = doc || {};

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
