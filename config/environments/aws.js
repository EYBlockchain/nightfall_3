module.exports = {
  name: 'AWS',
  chainId: 1337,
  clientApiUrl: `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`,
  optimistApiUrl: `https://${process.env.OPTIMIST_HTTP_HOST}`,
  optimistWsUrl: `wss://${process.env.OPTIMIST_HOST}`,
  proposerBaseUrl: `https://${process.env.PROPOSER_HOST}`,
  web3WsUrl: `wss://${process.env.BLOCKCHAIN_WS_HOST}`,
  adversarialOptimistApiUrl: `https://${process.env.OPTIMIST_HTTP_HOST}`,
  adversarialOptimistWsUrl: `wss://${process.env.OPTIMIST_HOST}`,
  PROPOSER_KEY: process.env.PROPOSER_KEY,
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
