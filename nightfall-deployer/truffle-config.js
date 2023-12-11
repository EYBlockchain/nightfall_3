/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

// eslint-disable-next-line import/no-extraneous-dependencies
const HDWalletProvider = require('@truffle/hdwallet-provider');
const config = require('config');

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.

    blockchain: {
      url: 'ws://blockchain:8546',
      network_id: 1337, // Any network (default: none)
      gas: 1000000000,
      websockets: true,
    },

    blockchain2: {
      url: 'ws://blockchain2:8546',
      network_id: 1337, // Any network (default: none)
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
      network_id: 1337, // Any network (default: none)
      gas: 8000000,
      websockets: true,
    },

    localhost: {
      provider: () => new HDWalletProvider(config.ETH_PRIVATE_KEY, config.BLOCKCHAIN_URL),
      network_id: 1337, // Any network (default: none)
      networkCheckTimeout: 1000000000,
      timeoutBlocks: 2000,
      gas: 6721975,
      websockets: true,
    },

    staging: {
      url: config.BLOCKCHAIN_URL,
      network_id: 1337, // Any network (default: none)
      gas: 8000000,
      websockets: true,
      networkCheckTimeout: 1000000000,
    },

    staging_edge: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [config.ETH_PRIVATE_KEY],
          providerOrUrl: config.BLOCKCHAIN_URL,
        }),
      network_id: 100, // Any network (default: none)
      gas: 8000000,
      gasPrice: config.WEB3_OPTIONS.gasPrice,
      websockets: true,
      networkCheckTimeout: 1000000000,
      timeoutBlocks: 2000,
    },
    mumbai: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [config.ETH_PRIVATE_KEY],
          providerOrUrl: config.BLOCKCHAIN_URL,
          chainId: 80001,
          pollingInterval: 40000000,
        }),
      network_id: 80001,
      networkCheckTimeout: 1000000000,
      timeoutBlocks: 2000,
      skipDryRun: true,
      websockets: true,
      gasPrice: config.WEB3_OPTIONS.gasPrice,
      gas: config.WEB3_OPTIONS.gas,
      disableConfirmationListener: true,
    },
    polygonPos: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [config.ETH_PRIVATE_KEY],
          providerOrUrl: config.BLOCKCHAIN_URL,
          chainId: 137,
        }),
      network_id: 137,
      networkCheckTimeout: 1000000000,
      timeoutBlocks: 2000,
      skipDryRun: true,
      websockets: true,
      gasPrice: config.WEB3_OPTIONS.gasPrice,
      gas: config.WEB3_OPTIONS.gas,
    },
    mainnet: {
      provider: () => new HDWalletProvider(config.ETH_PRIVATE_KEY, config.BLOCKCHAIN_URL),
      network_id: 1,
      networkCheckTimeout: 1000000000,
      timeoutBlocks: 2000,
      skipDryRun: true,
      websockets: true,
      gasPrice: config.WEB3_OPTIONS.gasPrice,
      gas: config.WEB3_OPTIONS.gas,
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {},

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.8.17', // Fetch exact version from solc-bin (default: truffle's version)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 1,
        },
      },
    },
  },
  plugins: ['truffle-contract-size'],
};
