const environments = require('./environments');
const restrictions = require('./tempRestrictions/restrictions');
const testOptions = require('./testOptions/testOptions');

function configureAWSBucket() {
  const bucket = 'nightfallv3';
  const mode = process.env.REACT_APP_MODE; // options are 'local', 'internal', 'preprod', 'production', 'staging', and 'testnet'
  if (mode === 'local') return bucket;
  return `${bucket}-${mode}`;
}

module.exports = {
  ENVIRONMENTS: environments,
  TEST_OPTIONS: testOptions,
  RESTRICTIONS: restrictions,

  COMMITMENTS_DB: 'nightfall_commitments',
  OPTIMIST_DB: 'optimist_data',
  PROPOSER_COLLECTION: 'proposers',
  CHALLENGER_COLLECTION: 'challengers',
  TRANSACTIONS_COLLECTION: 'transactions',
  SUBMITTED_BLOCKS_COLLECTION: 'blocks',
  INVALID_BLOCKS_COLLECTION: 'invalid_blocks',
  COMMIT_COLLECTION: 'commits',
  COMMITMENTS_COLLECTION: 'commitments',
  TIMBER_COLLECTION: 'timber',
  CIRCUIT_COLLECTION: 'circuit_storage',
  CIRCUIT_HASH_COLLECTION: 'circuit_hash_storage',
  KEYS_COLLECTION: 'keys',
  CONTRACT_ARTIFACTS: '/app/build/contracts',
  EXCLUDE_DIRS: 'common',
  MAX_QUEUE: 5,
  TIMBER_HEIGHT: 32,
  TXHASH_TREE_HEIGHT: 5,
  CONFIRMATION_POLL_TIME: 1000,
  CONFIRMATIONS: 12,
  DEFAULT_ACCOUNT_NUM: 10,
  HASH_TYPE: 'poseidon',
  TXHASH_TREE_HASH_TYPE: 'keccak256',
  STATE_GENESIS_BLOCK: process.env.STATE_GENESIS_BLOCK,
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP || false,
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  MONGO_URL: process.env.MONGO_URL || 'mongodb://localhost:27017/',
  PROTOCOL: 'http://', // connect to zokrates microservice like this
  WEBSOCKET_PORT: process.env.WEBSOCKET_PORT || 8080,
  WEBSOCKET_PING_TIME: 15000,
  ZOKRATES_WORKER_HOST: process.env.ZOKRATES_WORKER_HOST || 'worker',
  MULTISIG: {
    SIGNATURE_THRESHOLD: process.env.MULTISIG_SIGNATURE_THRESHOLD || 2, // number of signatures needed to perform an admin task
    APPROVERS: process.env.MULTISIG_APPROVERS
      ? process.env.MULTISIG_APPROVERS.split(',')
      : [
          '0x9C8B2276D490141Ae1440Da660E470E7C0349C63',
          '0xfeEDA3882Dd44aeb394caEEf941386E7ed88e0E0',
          '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
          '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
        ],
  },
  BLOCKCHAIN_URL:
    process.env.BLOCKCHAIN_URL ||
    `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}${
      process.env.BLOCKCHAIN_PATH || ''
    }`,
  ETH_PRIVATE_KEY: process.env.ETH_PRIVATE_KEY, // owner's/deployer's private key
  ETH_ADDRESS: process.env.ETH_ADDRESS,
  PROVING_SCHEME: process.env.PROVING_SCHEME || 'g16',
  BACKEND: process.env.BACKEND || 'bellman',
  CURVE: process.env.CURVE || 'bn128',

  TRANSACTIONS_PER_BLOCK: Number(process.env.TRANSACTIONS_PER_BLOCK) || 2,
  RETRIES: Number(process.env.AUTOSTART_RETRIES) || 150,
  USE_STUBS: process.env.USE_STUBS === 'true',
  VK_IDS: { deposit: 0, transfer: 1, withdraw: 2 }, // used as an enum to mirror the Shield contracts enum for vk types. The keys of this object must correspond to a 'folderpath' (the .zok file without the '.zok' bit)
  MPC: {
    MPC_PARAMS_URL:
      'https://nightfallv3-proving-files.s3.eu-west-1.amazonaws.com/phase2/mpc_params',
  },
  DEPLOYMENT_FILES_URL: {
    DEFAULT_CIRCUIT_FILES_URL: 'https://nightfallv3-proving-files.s3.eu-west-1.amazonaws.com',
    DEFAULT_CONTRACT_FILES_URL: 'https://nightfallv3-proving-files.s3.eu-west-1.amazonaws.com',
  },

  // for Browser use
  proposerUrl:
    process.env.LOCAL_PROPOSER === 'true'
      ? process.env.LOCAL_API_URL
      : process.env.PROPOSER_API_URL,

  eventWsUrl:
    process.env.LOCAL_PROPOSER === 'true' ? process.env.LOCAL_WS_URL : process.env.PROPOSER_WS_URL,

  AWS: {
    s3Bucket: configureAWSBucket(),
  },

  utilApiServerUrl: process.env.LOCAL_UTIL_API_URL,

  // assumption is if LOCAL_PROPOSER is true, wallet UI app
  // is running in local machine
  isLocalRun: process.env.LOCAL_PROPOSER === 'true',
  SIGNATURES: {
    BLOCK: '(uint48,address,bytes32,uint256,bytes32,bytes32, bytes32)',
    TRANSACTION:
      '(uint112,uint112,uint8,uint8,uint64[4],bytes32,bytes32,bytes32,bytes32[3],bytes32[4],bytes32[2],uint256[4])',
    PROPOSE_BLOCK: [
      '(uint48,address,bytes32,uint256,bytes32,bytes32,bytes32)',
      '(uint112,uint112,uint8,uint8,uint64[4],bytes32,bytes32,bytes32,bytes32[3],bytes32[4],bytes32[2],uint256[4])[]',
    ],
    SUBMIT_TRANSACTION:
      '(uint112,uint112,uint8,uint8,uint64[4],bytes32,bytes32,bytes32,bytes32[3],bytes32[4],bytes32[2],uint256[4])',
  },
};
