/**
@module default.js
@author iAmMichaelConnor
@desc constants used by a number of other modules
*/

let nodeHashLength;
let contracts;

if (process.env.HASH_TYPE === 'mimc') {
  nodeHashLength = 32;
  if (process.env.CURVE === 'BLS12_377') {
    contracts = ['MerkleTreeControllerMiMC_BLS12'];
  } else {
    contracts = ['MerkleTreeControllerMiMC_BN254'];
  }
} else {
  nodeHashLength = 27;
  contracts = ['MerkleTreeControllerSHA', 'MultipleMerkleTreesControllerSHA'];
}

module.exports = {
  LEVEL_DB_PATH: '/app/db/db',
  POLLING_FREQUENCY: 6000, // How many milliseconds to wait between each poll
  HASH_TYPE: process.env.HASH_TYPE,
  CURVE: process.env.CURVE,
  NODE_HASHLENGTH: nodeHashLength, // expected length of nodes' values up the merkle tree, in bytes

  // deployed contract info, for test scripts
  contractNames: contracts,

  // push the contract information, or wait for it to be pulled
  PUSH_OR_PULL: process.env.PUSH_OR_PULL,

  contracts: {
    // contract name:
    MerkleTreeControllerMiMC_BN254: {
      events: {
        // filter for the following event names:
        NewLeaf: {
          // filter for these event parameters:
          parameters: ['leafIndex', 'leafValue'],
        },
        NewLeaves: {
          // filter for these event parameters:
          parameters: ['minLeafIndex', 'leafValues'],
        },
      },
    },
    // contract name:
    MerkleTreeControllerMiMC_BLS12: {
      events: {
        // filter for the following event names:
        NewLeaf: {
          // filter for these event parameters:
          parameters: ['leafIndex', 'leafValue'],
        },
        NewLeaves: {
          // filter for these event parameters:
          parameters: ['minLeafIndex', 'leafValues'],
        },
      },
    },
    // contract name:
    MerkleTreeControllerMiMC_BW6: {
      events: {
        // filter for the following event names:
        NewLeaf: {
          // filter for these event parameters:
          parameters: ['leafIndex', 'leafValue'],
        },
        NewLeaves: {
          // filter for these event parameters:
          parameters: ['minLeafIndex', 'leafValues'],
        },
      },
    },
    // contract name:
    MerkleTreeControllerSHA: {
      events: {
        // filter for the following event names:
        NewLeaf: {
          // filter for these event parameters:
          parameters: ['leafIndex', 'leafValue'],
        },
        NewLeaves: {
          // filter for these event parameters:
          parameters: ['minLeafIndex', 'leafValues'],
        },
      },
    },
  },

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
