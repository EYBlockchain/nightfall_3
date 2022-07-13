module.exports = {
  TRUFFLE: {
    networks: {
      ganache: {
        url: 'ws://blockchain1:8546',
        network_id: 1337, // Any network (default: none)
        gas: 1000000000,
        websockets: true,
      },

      localhost: {
        url: 'ws://localhost:8546',
        network_id: 1337, // Any network (default: none)
        gas: 8000000,
        websockets: true,
      },

      geth: {
        url: 'ws://host.docker.internal:8546',
        network_id: 1337, // Any network (default: none)
        gas: 8000000,
        websockets: true,
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
