const config = {
  clientBaseUrl: `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`,
  optimistBaseUrl: `http://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_HTTP_PORT}`,
  optimistWsUrl: `ws://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_WS_PORT}`,
  web3WsUrl: `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}`,
  userEthereumSigningKey: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
};

export default config;
