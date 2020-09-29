module.exports = {
  // These defaults are used if not set by an environment variable
  PROTOCOL: 'http://', // connect to zokrates microservice like this
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  INNER_CHECKS_VK_TEMPLATE_PATH:
    process.env.INNER_CHECKS_VK_TEMPLATE_PATH || 'zvm/2in2out/inner-checks-vk.zokm',
  INNER_CHECKS_VK_PATH: process.env.INNER_CHECKS_VK_PATH || 'zvm/2in2out/inner-checks-vk.zok',
  INNER_CHECKS_PATH: process.env.INNER_CHECKS_PATH || 'zvm/2in2out/inner-checks.zok',
  OUTER_VERIFICATION_PATH:
    process.env.OUTER_VERIFICATION_PATH || 'zvm/2in2out/outer-verification.zok',
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP == 1, // eslint-disable-line eqeqeq, intentionally loose equality reads 1/0 as truthy/falsey
  ZOKRATES_HOST: process.env.ZOKRATES_HOST || 'zokrates',
  BLOCKCHAIN_HOST: process.env.BLOCKCHAIN_HOST || 'ws://openethereum',
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || '8546',
  WEB3_OPTIONS: {
    defaultAccount: '0x0',
    defaultBlock: '0', // e.g. the genesis block our blockchain
    defaultGas: 100000,
    defaultGasPrice: 20000000000,
    transactionBlockTimeout: 50,
    transactionConfirmationBlocks: 15,
    transactionPollingTimeout: 480,
    // transactionSigner: new CustomTransactionSigner()
  },
  CONTRACT_ARTIFACTS: '/app/build/contracts/',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
