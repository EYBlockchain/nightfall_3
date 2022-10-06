module.exports = {
  name: 'Polygon Edge',
  chainId: 100,
  clientApiUrl: process.env.CLIENT_HOST
    ? `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`
    : 'http://localhost:8080',
  optimistApiUrl: process.env.OPTIMIST_HOST
    ? `http://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_PORT}`
    : 'http://localhost:8081',
  optimistWsUrl: process.env.OPTIMIST_HOST
    ? `ws://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_WS_PORT}`
    : 'ws://localhost:8082',
  proposerBaseUrl: process.env.PROPOSER_HOST
    ? `http://${process.env.PROPOSER_HOST}:${process.env.PROPOSER_PORT}`
    : 'http://localhost:8092',
  adversarialOptimistApiUrl: 'http://localhost:8088',
  adversarialOptimistWsUrl: 'ws://localhost:8089',
  web3WsUrl: `ws://localhost:10002/ws`,
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
