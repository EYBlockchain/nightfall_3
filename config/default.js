module.exports = {
  COMMITMENTS_DB: 'nightfall_commitments',
  OPTIMIST_DB: 'optimist_data',
  METADATA_COLLECTION: 'metadata',
  TRANSACTIONS_COLLECTION: 'transactions',
  SUBMITTED_BLOCKS_COLLECTION: 'blocks',
  NULLIFIER_COLLECTION: 'nullifiers',
  COMMIT_COLLECTION: 'commits',
  WALLETS_COLLECTION: 'wallets',
  COMMITMENTS_COLLECTION: 'commitments',
  PEERS_COLLECTION: 'peers',
  CONTRACT_ARTIFACTS: '/app/build/contracts',
  PROPOSERS_CONTRACT_NAME: 'Proposers',
  SHIELD_CONTRACT_NAME: 'Shield',
  CHALLENGES_CONTRACT_NAME: 'Challenges',
  STATE_CONTRACT_NAME: 'State',
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP || false,
  EXCLUDE_DIRS: 'common', // don't setup files with this in their path
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  MONGO_URL: process.env.MONGO_URL || 'mongodb://localhost:27017/',
  ZKP_KEY_LENGTH: 32, // use a 32 byte key length for SHA compatibility
  PROTOCOL: 'http://', // connect to zokrates microservice like this
  WEBSOCKET_PORT: process.env.WEBSOCKET_PORT || 8080,
  ZOKRATES_WORKER_HOST: process.env.ZOKRATES_WORKER_HOST || 'worker',
  BLOCKCHAIN_WS_HOST: process.env.BLOCKCHAIN_WS_HOST || 'openethereum',
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || '8546',
  TIMBER_HOST: process.env.TIMBER_HOST || 'timber',
  TIMBER_PORT: process.env.TIMBER_PORT || 80,
  OPTIMIST_HOST: process.env.OPTIMIST_HOST || 'optimist',
  OPTIMIST_PORT: process.env.OPTIMIST_PORT || 80,
  WEB3_OPTIONS: {
    gas: process.env.GAS || 1000000,
    gasPrice: process.env.GAS_PRICE || '20000000000',
    from: process.env.FROM_ADDRESS || undefined,
  },
  PROVING_SCHEME: process.env.PROVING_SCHEME || 'gm17',
  BACKEND: process.env.BACKEND || 'libsnark',
  CURVE: process.env.CURVE || 'bn128',
  PROOF_QUEUE: 'generate-proof',
  BN128_GROUP_ORDER: 21888242871839275222246405745257275088548364400416034343698204186575808495617n,
  BN128_PRIME_FIELD: 21888242871839275222246405745257275088696311157297823662689037894645226208583n,
  TRANSACTIONS_PER_BLOCK: Number(process.env.TRANSACTIONS_PER_BLOCK) || 2,
  TIMBER_SYNC_RETRIES: 5, // Sets amount of exponential backoff attempts to sync with timber.
  PROPOSE_BLOCK_TYPES: [
    '(uint48,address,bytes32)',
    '(uint64,uint64,uint8,uint8,bytes32,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],uint[4])[]',
  ], // used to encode/decode proposeBlock signature
  SUBMIT_TRANSACTION_TYPES:
    '(uint64,uint64,uint8,uint8,bytes32,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],uint[4])',
  RETRIES: process.env.AUTOSTART_RETRIES || 50,
  NODE_HASHLENGTH: 32,
  ZERO: '0x0000000000000000000000000000000000000000000000000000000000000000',
  HASH_TYPE: 'mimc',
  USE_STUBS: process.env.USE_STUBS === 'true',
  VK_IDS: { deposit: 0, single_transfer: 1, double_transfer: 2, withdraw: 3 }, // used as an enum to mirror the Shield contracts enum for vk types. The keys of this object must correspond to a 'folderpath' (the .zok file without the '.zok' bit)
  MAX_QUEUE: 5,
};
