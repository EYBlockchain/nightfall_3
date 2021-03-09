module.exports = {
  // These defaults are used if not set by an environment variable
  PROTOCOL: 'http://', // connect to zokrates microservice like this
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP || false,
  ZOKRATES_WORKER_HOST: process.env.ZOKRATES_WORKER_HOST || 'worker',
  BLOCKCHAIN_WS_HOST: process.env.BLOCKCHAIN_WS_HOST || 'ws://openethereum',
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || '8546',
  WEB3_OPTIONS: {
    gas: process.env.GAS || 1000000,
    gasPrice: process.env.GAS_PRICE || '20000000000',
    from: process.env.FROM_ADDRESS || undefined,
  },
  CONTRACT_ARTIFACTS: '/app/build/contracts/',
  EXCLUDE_DIRS: 'common', // don't setup files with this in their path
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  VK_IDS: { deposit: 0, single_transfer: 1, double_transfer: 2, withdraw: 3 }, // used as an enum to mirror the Shield contracts enum for vk types. The keys of this object must correspond to a 'folderpath' (the .zok file without the '.zok' bit)
  TIMBER_HOST: process.env.TIMBER_HOST || 'timber',
  TIMBER_PORT: process.env.TIMBER_PORT || 80,
  SHIELD_CONTRACT_NAME: 'Shield',
  BACKEND: process.env.BACKEND || 'libsnark',
  CURVE: process.env.CURVE || 'bn128',
  PROVING_SCHEME: process.env.PROVING_SCHEME || 'gm17',
};
