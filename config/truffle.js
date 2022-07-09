const { WEB3_OPTIONS, BLOCKCHAIN_URL } = require('./common');

module.exports = {
  TRUFFLE: {
    networks: {
      blockchain1: {
        url: 'ws://blockchain1:8546',
        network_id: 4378921, // Any network (default: none)
        gas: 1000000000,
        websockets: true,
      },

      blockchain2: {
        url: 'ws://blockchain2:8546',
        network_id: 4378921, // Any network (default: none)
        gas: 8000000,
        websockets: true,
      },

      ganache: {
        host: 'ganache', // Localhost (default: none)
        port: 8545, // Standard Ethereum port (default: none)
        network_id: '*', // Any network (default: none)
        gas: 8000000,
      },

      development: {
        url: 'ws://host.docker.internal:8546',
        network_id: 4378921, // Any network (default: none)
        gas: 8000000,
        websockets: true,
      },

      localhost: {
        url: 'ws://localhost:8546',
        network_id: 4378921, // Any network (default: none)
        gas: 8000000,
        websockets: true,
      },

      staging: {
        url: BLOCKCHAIN_URL,
        network_id: 4378921, // Any network (default: none)
        gas: 8000000,
        websockets: true,
        networkCheckTimeout: 1000000000,
      },

      ropsten: {
        network_id: 3,
        networkCheckTimeout: 1000000000,
        timeoutBlocks: 2000,
        skipDryRun: true,
        websockets: true,
        gasPrice: WEB3_OPTIONS.gasPrice,
        gas: 7000000,
      },

      goerli: {
        network_id: 5,
        networkCheckTimeout: 1000000000,
        timeoutBlocks: 2000,
        skipDryRun: true,
        websockets: true,
        gasPrice: WEB3_OPTIONS.gasPrice,
        gas: WEB3_OPTIONS.gas,
      },
      mainnet: {
        network_id: 1,
        networkCheckTimeout: 1000000000,
        timeoutBlocks: 2000,
        skipDryRun: true,
        websockets: true,
        gasPrice: WEB3_OPTIONS.gasPrice,
        gas: WEB3_OPTIONS.gas,
      },
    },

    compilers: {
      solc: {
        version: '0.8.3',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    },
    plugins: ['truffle-contract-size'],
  },
};
