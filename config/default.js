module.exports = {
  // These defaults are used if not set by an environment variable
  PROTOCOL: 'http://', // connect to zokrates microservice like this
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP || false,
  ZOKRATES_WORKER_HOST: process.env.ZOKRATES_WORKER_HOST || 'worker',
  BLOCKCHAIN_HOST: process.env.BLOCKCHAIN_HOST || 'ws://openethereum',
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || '8546',
  WEB3_OPTIONS: {
    gas: process.env.GAS || 1000000,
    gasPrice: process.env.GAS_PRICE || '20000000000',
    from: process.env.FROM_ADDRESS || undefined,
  },
  CONTRACT_ARTIFACTS: '/app/build/contracts/',
  EXCLUDE_DIRS: 'common', // don't setup files with this in their path
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  transactionTypes: { DEPOSIT: 0, TRANSFER: 1, WITHDRAW: 2 }, // used as an enum to mirror the Shield contracts enum for vk types.
};
