module.exports = {
    networks: {
        blockchain: {
            url: 'ws://blockchain:8546',
            chainId: 1337, // Any network (default: none)
            gas: 1000000000,
        },
    
        blockchain2: {
            url: 'ws://blockchain2:8546',
            chainId: 1337, // Any network (default: none)
            gas: 8000000,
        },
    
        ganache: {
            host: 'ganache:8545', // Localhost (default: none)
            chainId: '*', // Any network (default: none)
            gas: 8000000,
        },
    
        development: {
            url: 'ws://host.docker.internal:8546',
            chainId: 1337, // Any network (default: none)
            gas: 8000000,
        },
    
        localhost: {
            url: config.BLOCKCHAIN_URL,
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 1337, // Any network (default: none)
            timeout: 1000000000,
            gas: 6721975,
        },
    
        staging: {
            url: config.BLOCKCHAIN_URL,
            chainId: 1337, // Any network (default: none)
            gas: 8000000,
            timeout: 1000000000,
        },
    
        staging_edge: {
            url: config.BLOCKCHAIN_URL,
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 100, // Any network (default: none)
            gas: 8000000,
            gasPrice: config.WEB3_OPTIONS.gasPrice,
            timeout: 1000000000,
        },

        mumbai: {
            url: config.BLOCKCHAIN_URL,
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 80001,
            timeout: 1000000000,
            gasPrice: config.WEB3_OPTIONS.gasPrice,
            gas: config.WEB3_OPTIONS.gas,
        },

        polygonPos: {
            url: config.BLOCKCHAIN_URL,
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 137,
            timeout: 1000000000,
            gasPrice: config.WEB3_OPTIONS.gasPrice,
            gas: config.WEB3_OPTIONS.gas,
        },
        mainnet: {
            url: config.BLOCKCHAIN_URL,
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 1,
            timeout: 1000000000,
            gasPrice: config.WEB3_OPTIONS.gasPrice,
            gas: config.WEB3_OPTIONS.gas,
        },
    },
  
    // Configure your compilers
    solidity: {
        version: '0.8.17', // Fetch exact version from solc-bin (default: truffle's version)
        settings: {
          // See the solidity docs for advice about optimization and evmVersion
            optimizer: {
                enabled: true,
                runs: 1,
            },
        },
    },
}