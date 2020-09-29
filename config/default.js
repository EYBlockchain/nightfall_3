module.exports = {
  // These defaults are used if not set by an environment variable
  PROTOCOL: 'http://', // connect to zokrates microservice like this
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  DEPOSIT_PATH: process.env.DEPOSIT_PATH || 'deposit.zok',
  TRANSFER_PATH: process.env.TRANSFER_PATH || 'transfer.zok',
  WITHDRAW_PATH: process.env.WITHDRAW_PATH || 'withdraw.zok',
  get TRUSTED_SETUPS_TODO() {
    return [this.DEPOSIT_PATH, this.TRANSFER_PATH];
  },
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP || false,
  ZOKRATES_WORKER_HOST: process.env.ZOKRATES_WORKER_HOST || 'worker',
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
