/**
@module default.js
@author iAmMichaelConnor
@desc constants used by a nubmer of other modules
*/

module.exports = {
  // general:
  ZERO: '0x0000000000000000000000000000000000000000000000000000000000000000', // 32-bit hex string representing zero, for hashing with '0' up the tree.
  LEAF_HASHLENGTH: 32, // expected length of leaves' values in bytes
  NODE_HASHLENGTH: 27, // expected length of nodes' values up the merkle tree, in bytes

  TREE_HEIGHT: 32, // the hieght of the Merkle tree

  POLLING_FREQUENCY: 6000, // milliseconds
  FILTER_GENESIS_BLOCK_NUMBER: 0, // blockNumber

  tolerances: {
    LAG_BEHIND_CURRENT_BLOCK: 5, // add warnings for use of tree data which lags further behind the current block (e.g. due to anonymity concerns)
  },

  UPDATE_FREQUENCY: 100, // recalculate the tree every 'x' leaves - NOT USED YET
  BULK_WRITE_BUFFER_SIZE: 1000, // number of documents to add to a buffer before writing them to the db

  // contract to filter:
  contract: {
    name: 'MerkleTreeController',
    events: {
      // indexed by event names:
      newLeaf: {
        parameters: ['leafIndex', 'leafValue', 'root'], // filter for these parameters
      },
      newLeaves: {
        parameters: ['minLeafIndex', 'leafValues', 'root'], // filter for these parameters
      },
    }, // even if only filtering for one event, keep the array brackets []
    deploymentLocality: process.env.DEPLOYMENT_LOCALITY, // 'local' or 'remote'
  },

  // mongodb:
  mongo: {
    host: 'mongo',
    port: '27017',
    databaseName: 'merkle_tree',
    admin: 'admin',
    adminPassword: 'admin',
  },
  isLoggerEnabled: true,

  // external contract deployment microservice (which deploys the MerkleTree.sol contract):
  deployer: {
    host: process.env.DEPLOYER_HOST,
    port: process.env.DEPLOYER_PORT,
  },

  // web3:
  web3: {
    host: process.env.BLOCKCHAIN_HOST,
    port: process.env.BLOCKCHAIN_PORT,

    options: {
      defaultAccount: '0x0',
      defaultBlock: '0', // e.g. the genesis block our blockchain
      defaultGas: 100000,
      defaultGasPrice: 20000000000,
      transactionBlockTimeout: 50,
      transactionConfirmationBlocks: 15,
      transactionPollingTimeout: 480,
      // transactionSigner: new CustomTransactionSigner()
    },
  },
};
