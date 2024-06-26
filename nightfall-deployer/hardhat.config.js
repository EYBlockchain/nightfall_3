
require("@nomicfoundation/hardhat-ethers");
require('@openzeppelin/hardhat-upgrades');


const config = require('config');

function toHttpUrl(url) {
    return url.includes('ws://') ? url.replace('ws://', 'http://') : url;
}

module.exports = {
    networks: {
        blockchain: {
            url: 'http://blockchain:8546',
            chainId: 1337, // Any network (default: none)
            gas: 1000000000,
            gasMultiplier: 2,
        },

        blockchain2: {
            url: 'http://blockchain2:8546',
            chainId: 1337, // Any network (default: none) 
            gas: 8000000,
            gasMultiplier: 2,
        },

        ganache: {
            url: 'http://ganache:8545', // Localhost (default: none)
            chainId: 1337, // Any network (default: none)
            gas: 8000000,
            gasMultiplier: 2,
        },

        development: {
            url: 'http://host.docker.internal:8546',
            chainId: 1337, // Any network (default: none)
            gas: 8000000,
            gasMultiplier: 2,
        },

        localhost: {
            url: toHttpUrl(config.BLOCKCHAIN_URL),
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 1337, // Any network (default: none)
            timeout: 1000000000,
            gas: 6721975,
        },

        staging: {
            url: toHttpUrl(config.BLOCKCHAIN_URL),
            chainId: 1337, // Any network (default: none)
            gas: 8000000,
            timeout: 1000000000,
        },

        staging_edge: {
            url: toHttpUrl(config.BLOCKCHAIN_URL),
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 100, // Any network (default: none)
            gas: 8000000,
            gasMultiplier: 2,
            timeout: 1000000000,
        },

        mumbai: {
            url: toHttpUrl(config.BLOCKCHAIN_URL),
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 80001,
            timeout: 1000000000,
            gasMultiplier: 2,
            gas: config.WEB3_OPTIONS.gas,
        },

        polygonPos: {
            url: toHttpUrl(config.BLOCKCHAIN_URL),
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 137,
            timeout: 1000000000,
            gasMultiplier: 2,
            gas: config.WEB3_OPTIONS.gas,
        },
        mainnet: {
            url: toHttpUrl(config.BLOCKCHAIN_URL),
            accounts: [config.ETH_PRIVATE_KEY],
            chainId: 1,
            timeout: 1000000000,
            gasMultiplier: 2,
            gas: config.WEB3_OPTIONS.gas,
        },
    },

    // Configure your compilers
    solidity: {
        version: '0.8.17', // Fetch exact version from solc-bin (default: Hardhats's version)
        settings: {
            // See the solidity docs for advice about optimization and evmVersion
            optimizer: {
                enabled: true,
                runs: 1,
            },
        },
    },
}