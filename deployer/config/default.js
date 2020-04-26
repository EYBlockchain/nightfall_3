/**
@module default.js
@author iAmMichaelConnor
@desc constants used by a number of other modules
*/
const nodeHashLength = process.env.HASH_TYPE === 'mimc' ? 32 : 27;
const controller =
  process.env.HASH_TYPE === 'mimc' ? 'MerkleTreeControllerMiMC' : 'MerkleTreeControllerSHA';
const contracts = [controller];

module.exports = {
  LEVEL_DB_PATH: '/app/db/db',
  POLLING_FREQUENCY: 6000, // How many milliseconds to wait between each poll
  HASH_TYPE: process.env.HASH_TYPE,
  NODE_HASHLENGTH: nodeHashLength, // expected length of nodes' values up the merkle tree, in bytes

  // deployed contract info:
  contractNames: contracts,

  // push the contract information, or wait for it to be pulled
  PUSH_OR_PULL: process.env.PUSH_OR_PULL,

  // microservices:
  merkleTree: {
    host: process.env.MERKLE_TREE_HOST,
    port: process.env.MERKLE_TREE_PORT,
  },

  // this deployer's url, for testing:
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
      defaultGas: 2000000,
      defaultGasPrice: 20000000000,
      transactionBlockTimeout: 50,
      transactionConfirmationBlocks: 15,
      transactionPollingTimeout: 480,
      // transactionSigner: new CustomTransactionSigner()
    },
  },
};
