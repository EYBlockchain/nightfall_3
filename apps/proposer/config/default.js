/*
 @deprecated This file will be removed soon. Please, don't add changes to it.
*/

module.exports = {
  SIGNING_KEY:
    process.env.SIGNING_KEY || '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
  PROPOSER_HOST: process.env.PROPOSER_HOST || 'localhost',
  PROPOSER_PORT: process.env.PROPOSER_PORT || 8092,
  OPTIMIST_HOST: process.env.OPTIMIST_HOST || 'localhost',
  OPTIMIST_PORT: process.env.OPTIMIST_PORT || 8081,
  OPTIMIST_WS_PORT: process.env.OPTIMIST_WS_PORT || 8082,
  BLOCKCHAIN_WS_HOST: process.env.BLOCKCHAIN_WS_HOST || 'localhost',
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || 8546,
  BLOCKCHAIN_PATH: process.env.BLOCKCHAIN_PATH || '',
};
