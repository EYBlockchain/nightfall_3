module.exports = {
  SIGNING_KEY:
    process.env.SIGNING_KEY || '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
  OPTIMIST_HOST: process.env.OPTIMIST_HOST || 'localhost',
  OPTIMIST_PORT: process.env.OPTIMIST_PORT || 8081,
  OPTIMIST_WS_PORT: process.env.OPTIMIST_WS_PORT || 8082,
  BLOCKCHAIN_WS_HOST: process.env.BLOCKCHAIN_WS_HOST || 'localhost',
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || 8546,
  BLOCKCHAIN_PATH: process.env.BLOCKCHAIN_PATH || '',
  CHALLENGER_PORT: process.env.CHALLENGER_PORT || 8085,
};
