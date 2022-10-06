module.exports = {
  name: 'Docker',
  chainId: 1337,
  clientApiUrl: 'http://client:80',
  optimistApiUrl: 'http://optimist:80',
  optimistWsUrl: 'ws://optimist:8080',
  proposerBaseUrl: 'http://proposer:80',
  adversarialOptimistApiUrl: 'http://localhost:8088',
  adversarialOptimistWsUrl: 'ws://localhost:8089',
  web3WsUrl: 'ws://blockchain:8546',
  PROPOSER_KEY: process.env.PROPOSER_KEY, // owner's/deployer's private key
  DEFAULT_BLOCK_STAKE: 1,
  WEB3_OPTIONS: {
    gas: process.env.GAS || 8000000,
    gasPrice: process.env.GAS_PRICE || '20000000000',
    from: process.env.FROM_ADDRESS || process.env.ETH_ADDRESS,
    estimateGasEndpoint:
      process.env.GAS_ESTIMATE_ENDPOINT ||
      'https://vqxy02tr5e.execute-api.us-east-2.amazonaws.com/production/estimateGas',
    fee: 10,
  },
  WEB3_PROVIDER_OPTIONS: {
    clientConfig: {
      // Useful to keep a connection alive
      keepalive: true,
      // Keep keepalive interval small so that socket doesn't die
      keepaliveInterval: 1500,
    },
    timeout: 0,
    reconnect: {
      auto: true,
      delay: 5000, // ms
      maxAttempts: 120,
      onTimeout: false,
    },
  },
};
