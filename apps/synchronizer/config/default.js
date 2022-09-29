module.exports = {
  SYNCHRONIZER_PORT: process.env.SYNCHRONIZER_PORT || 8092,
  CLIENT_HOST: process.env.CLIENT_HOST || 'localhost',
  CLIENT_PORT: process.env.CLIENT_PORT || 8080,
  OPTIMIST_HOST: process.env.OPTIMIST_HOST || 'localhost',
  OPTIMIST_PORT: process.env.OPTIMIST_PORT || 8081,
  OPTIMIST_WS_PORT: process.env.OPTIMIST_WS_PORT || 8082,
  BLOCKCHAIN_WS_HOST: process.env.BLOCKCHAIN_WS_HOST || 'localhost',
  BLOCKCHAIN_PATH: process.env.BLOCKCHAIN_PATH || '',
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || 8546,
};
