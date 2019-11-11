/**
 * @module node.service.js
 * @author iAmMichaelConnor
 * @desc orchestrates inserts to and gets from the mongodb
 */

import { COLLECTIONS } from '../common/constants';
import { nodeMapper } from '../mappers';

export default class NodeService {
  constructor(_db) {
    this.db = _db;
  }

  // INSERTS

  /**
  Insert a new node (not a leaf) into the merkle tree
  @param {object} data
  */
  async insertNode(data) {
    console.log('\nsrc/db/service/node.service insertNode()');
    // console.log('data before mapping:', data);
    const mappedData = nodeMapper(data);
    // console.log('data after mapping:', mappedData);

    // insert the node into the 'nodes' collection:
    const dbResponse = await this.db.save(COLLECTIONS.NODE, mappedData);

    return dbResponse;
  }

  // UPDATES

  /**
  Update a node (not a leaf) searching by its nodeIndex
  @param {integer} nodeIndex
  @param {object} data
  */
  async updateNodeByNodeIndex(nodeIndex, data) {
    console.log('\nsrc/db/service/node.service updateNodeByNodeIndex()');
    // console.log('data before mapping:', data);
    const mappedData = nodeMapper(data);
    // console.log('data after mapping:', mappedData);

    const doc = await this.db.updateDoc(
      COLLECTIONS.NODE,
      {
        nodeIndex,
      }, // query
      { $set: mappedData }, // update
    );

    return doc;
  }

  /**
  Update many nodes (not leaves). We implicitly update based on nodeIndex (by finding that index within the 'data')
  @param {array} data an array of node objects
  */
  async updateNodes(data) {
    console.log('\nsrc/db/service/node.service updateNodes()');
    // console.log('data before mapping:', data);
    const mappedData = data.map(item => nodeMapper(item));
    // console.log('data after mapping:', mappedData);

    const bulkUpdates = mappedData.map(item => ({
      updateOne: {
        filter: {
          nodeIndex: item.nodeIndex,
        },
        update: { $set: { value: item.value } },
        upsert: true, // create a new entry if the item ('node') doesn't yet exist in the db
      },
    }));

    const dbResponse = await this.db.bulkWrite(COLLECTIONS.NODE, bulkUpdates);

    return dbResponse;
  }

  // GETTERS

  // GETTERS FOR NODES

  /**
  Get a single node by its nodeIndex
  @param {number} nodeIndex
  @returns {object} the node object
  */
  async getNodeByNodeIndex(nodeIndex) {
    console.log('\nsrc/db/service/node.service getNodeByNodeIndex()');

    const doc = await this.db.getDoc(
      COLLECTIONS.NODE,
      { nodeIndex }, // query
      null, // don't filter the output
      { nodeIndex: 1 }, // sort by nodeIndex in ascending order
    );

    return doc;
  }

  /**
  Get many nodes by their nodeIndices
  @param {array} nodeIndices
  @returns {array} an array of node objects
  */
  async getNodesByNodeIndices(nodeIndices) {
    console.log('\nsrc/db/service/node.service getNodesByNodeIndices()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { nodeIndex: { $in: nodeIndices } }, // query
      null, // don't filter the output
      { nodeIndex: 1 }, // sort by nodeIndex in ascending order
    );

    return docs;
  }

  /**
  Get all nodes within a range determined by their nodeIndices
  @param {number} minIndex
  @param {number} maxIndex
  @returns {array} an array of node objects
  */
  async getNodesByNodeIndexRange(minIndex, maxIndex) {
    console.log('\nsrc/db/service/node.service getNodesByNodeIndexRange()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { nodeIndex: { $gte: minIndex, $lte: maxIndex } }, // query
      null, // don't filter the output
      { nodeIndex: 1 }, // sort by nodeIndex in ascending order
    );

    return docs;
  }

  /**
  Get a single node (or a set of nodes with duplicate values) by its value
  @param {string} value
  @returns {object} the node object(s)
  */
  async getNodeByValue(value) {
    console.log('\nsrc/db/service/node.service getNodeByValue()');

    const docs = await this.db.getDoc(COLLECTIONS.NODE, {
      value,
    });

    return docs;
  }

  /**
  Get many nodes by their values
  @param {array} values
  @returns {array} an array of node objects
  */
  async getNodesByValues(values) {
    console.log('\nsrc/db/service/node.service getNodesByValues()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { value: { $in: values } }, // query
      null, // don't filter the output
      { nodeIndex: 1 }, // sort by nodeIndex in ascending order
    );

    return docs;
  }

  /**
  Get all nodes.
  @returns {array} an array of node objects
  */
  async getNodes() {
    console.log('\nsrc/db/service/node.service getNodes()');

    const docs = await this.db.getDocs(
      COLLECTIONS.NODE,
      { nodeIndex: { $exists: true } }, // query
      null, // don't filter the output
      { nodeIndex: 1 }, // sort by nodeIndex in ascending order
    );

    return docs;
  }

  /**
  Get the root (i.e. the node at nodeIndex = 0)
  @returns {object} the root's node object
  */
  async getRoot() {
    console.log('\nsrc/db/service/node.service getRoot()');

    const doc = await this.db.getDoc(COLLECTIONS.NODE, {
      nodeIndex: { $eq: 0 },
    });

    return doc;
  }

  // OTHER

  /**
  Count the number of nodes stored in the merkle tree
  */
  async countNodes() {
    console.log('\nsrc/db/service/node.service countNodes()');

    const nodeCount = await this.db.countDocuments(COLLECTIONS.NODE, {
      nodeIndex: { $exists: true },
    });

    return nodeCount;
  }
}
