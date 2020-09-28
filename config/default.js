module.exports = {
  LOG_LEVEL: process.env.DEBUG_LEVEL || 'debug',
  MONGO_URL: process.env.MONGO_URL || 'mongodb://localhost:27017/',
  COMMITMENTS_DB: 'nightfall_commitments',
  WALLETS_COLLECTION: 'wallets',
  types: { FUNGIBLE: 'fungible', NON_FUNGIBLE: 'non-fungible' },
  ZKP_KEY_LENGTH: 32, // use a 32 byte key length for SHA compatibility
  ZOKRATES_WORKER_URL: 'http://localhost:8080',
};
