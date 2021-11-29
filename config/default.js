const { DOMAIN_NAME = '' } = process.env;

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
  TIMBER_COLLECTION: 'timber',
  CONTRACT_ARTIFACTS: '/app/build/contracts',
  PROPOSERS_CONTRACT_NAME: 'Proposers',
  SHIELD_CONTRACT_NAME: 'Shield',
  CHALLENGES_CONTRACT_NAME: 'Challenges',
  STATE_CONTRACT_NAME: 'State',
  BLOCK_PROPOSED_EVENT_NAME: 'BlockProposed',
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP || false,
  EXCLUDE_DIRS: 'common', // don't setup files with this in their path
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  MONGO_URL: process.env.MONGO_URL || 'mongodb://localhost:27017/',
  ZKP_KEY_LENGTH: 32, // use a 32 byte key length for SHA compatibility
  CONFIRMATION_POLL_TIME: 1000, // time to wait before querying the blockchain (ms). Must be << block interval
  CONFIRMATIONS: 12, // number of confirmations to wait before accepting a transaction
  PROTOCOL: 'http://', // connect to zokrates microservice like this
  WEBSOCKET_PORT: process.env.WEBSOCKET_PORT || 8080,
  ZOKRATES_WORKER_HOST: process.env.ZOKRATES_WORKER_HOST || 'worker',
  BLOCKCHAIN_URL:
    process.env.BLOCKCHAIN_URL ||
    `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}`,
  USE_INFURA: process.env.USE_INFURA === 'true',
  ETH_PRIVATE_KEY: process.env.ETH_PRIVATE_KEY, // owner's/deployer's private key
  ETH_ADDRESS: process.env.ETH_ADDRESS,
  USE_HOSTED_GETH: process.env.USE_HOSTED_GETH === 'true',
  OPTIMIST_HOST: process.env.OPTIMIST_HOST || 'optimist',
  OPTIMIST_PORT: process.env.OPTIMIST_PORT || 80,
  clientBaseUrl: `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`,
  // Define Urls and Url format (http/ws vs https/wss, with vs without port) depending on whether a DOMAIN_NAME has been defined.
  // In production and staging environements, we require https/wss and no port, as traffic will be routed to the correct service
  // given a URL.
  optimistBaseUrl:
    DOMAIN_NAME === ''
      ? `http://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_HTTP_PORT}`
      : `https://${process.env.OPTIMIST_HTTP_HOST}`,
  optimistWsUrl:
    DOMAIN_NAME === ''
      ? `ws://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_WS_PORT}`
      : `wss://${process.env.OPTIMIST_HOST}`,
  web3WsUrl:
    DOMAIN_NAME === ''
      ? `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}`
      : `wss://${process.env.BLOCKCHAIN_WS_HOST}`,
  userEthereumSigningKey:
    process.env.USER_ETHEREUM_SIGNING_KEY ||
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e', // if changed, change associated userEthereumAddresses
  userAddress: process.env.USER_ADDRESS,
  UserEthereumAddresses: process.env.USER_ETHEREUM_ADDRESSES
    ? process.env.USER_ETHEREUM_ADDRESSES.split(',')
    : [
        '0x9c8b2276d490141ae1440da660e470e7c0349c63',
        // '0x4ca4902a6f456b488947074ad4140317c7e21996', // 0xb0fa8745bd6e77a67ec6a27e701971d659937140cc3159d9f85210da3444eb45
        // '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9', // 0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb
      ],
  zkpMnemonic:
    process.env.ZKP_MNEMONIC ||
    'hurt labor ketchup seven scan swap dirt brown brush path goat together',
  proposerEthereumSigningKey:
    process.env.PROPOSER_ETHEREUM_SIGNING_KEY ||
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
  user1Pkd: process.env.RECIPIENT_PKD || [
    '0x193a37cd7973373aceae05d133f3d69ab6e7ef2f4321461173871ec7611244e2',
    '0x27234a8721e73c9aa160154ee63d2470101fc5fd841221eeb675a91ec2d66e78',
  ],
  user2Pkd: process.env.RECIPIENT_PKD || [
    '0x105651c0c5bb97582b3270e0f5a07ca81410ffd1920e86697efddaec03dccef8',
    '0x1ac3b61ecba1448e697b23d37efe290fb86554b2f905aaca3a6df59805eca366',
  ],
  WEB3_OPTIONS: {
    gas: process.env.GAS || 8000000,
    gasPrice: process.env.GAS_PRICE || '20000000000',
    from: process.env.FROM_ADDRESS || process.env.ETH_ADDRESS,
  },
  WEB3_PROVIDER_OPTIONS: {
    clientConfig: {
      // Useful to keep a connection alive
      keepalive: true,
      keepaliveInterval: 60000,
    },
    timeout: 3600000,
    reconnect: {
      auto: true,
      delay: 5000, // ms
      maxAttempts: 120,
      onTimeout: false,
    },
  },
  PROVING_SCHEME: process.env.PROVING_SCHEME || 'g16',
  BACKEND: process.env.BACKEND || 'bellman',
  CURVE: process.env.CURVE || 'bn128',
  PROOF_QUEUE: 'generate-proof',
  BN128_GROUP_ORDER: 21888242871839275222246405745257275088548364400416034343698204186575808495617n,
  BN128_PRIME_FIELD: 21888242871839275222246405745257275088696311157297823662689037894645226208583n,
  TRANSACTIONS_PER_BLOCK: Number(process.env.TRANSACTIONS_PER_BLOCK) || 2,
  PROPOSE_BLOCK_TYPES: [
    '(uint48,address,bytes32,uint256,bytes32)',
    '(uint64,uint64[2],uint8,uint8,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],bytes32[8],uint[4])[]',
  ], // used to encode/decode proposeBlock signature
  SUBMIT_TRANSACTION_TYPES:
    '(uint64,uint64[2],uint8,uint8,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],bytes32[8],uint[4])',
  RETRIES: Number(process.env.AUTOSTART_RETRIES) || 50,
  NODE_HASHLENGTH: 32,
  ZERO: '0x0000000000000000000000000000000000000000000000000000000000000000',
  HASH_TYPE: 'mimc',
  USE_STUBS: process.env.USE_STUBS === 'true',
  VK_IDS: { deposit: 0, single_transfer: 1, double_transfer: 2, withdraw: 3 }, // used as an enum to mirror the Shield contracts enum for vk types. The keys of this object must correspond to a 'folderpath' (the .zok file without the '.zok' bit)
  TIMBER_HEIGHT: 32,

  // the various parameters needed to describe the Babyjubjub curve that we use for El-Gamal
  // BABYJUBJUB
  // Montgomery EC form is y^2 = x^3 + Ax^2 + Bx
  // Montgomery EC form of BabyJubJub is y^2 = x^3 + 168698x^2 + x
  // A = 168698 and B = 1
  BABYJUBJUB: {
    JUBJUBA: BigInt(168700),
    JUBJUBD: BigInt(168696),
    INFINITY: [BigInt(0), BigInt(1)],
    GENERATOR: [
      BigInt('16540640123574156134436876038791482806971768689494387082833631921987005038935'),
      BigInt('20819045374670962167435360035096875258406992893633759881276124905556507972311'),
    ],
    JUBJUBE: BigInt(
      '21888242871839275222246405745257275088614511777268538073601725287587578984328',
    ),
    JUBJUBC: BigInt(8),
    MONTA: BigInt(168698),
    MONTB: BigInt(1),
  },
  ELLIGATOR2: {
    U: BigInt(5), // non square in Fp
  },
  MAX_QUEUE: 5,
  ENVIRONMENTS: {
    mainnet: {
      name: 'Mainnet',
      chainId: 1,
      clientApiUrl: '',
      optimistApiUrl: '',
      optimistWsUrl: '',
      web3WsUrl: '',
    },
    ropsten: {
      name: 'Ropsten',
      chainId: 3,
      clientApiUrl: 'https://client1.testnet.nightfall3.com',
      optimistApiUrl: 'https://optimist1.testnet.nightfall3.com',
      optimistWsUrl: 'wss://optimist1-ws.testnet.nightfall3.com',
      web3WsUrl: `${process.env.ROPSTEN_NODE}`,
    },
    rinkeby: {
      name: 'Rinkeby',
      chainId: 4,
      clientApiUrl: '',
      optimistApiUrl: '',
      optimistWsUrl: '',
      web3WsUrl: '',
    },
    localhost: {
      name: 'Localhost',
      chainId: 4378921,
      clientApiUrl: 'http://localhost:8080',
      optimistApiUrl: 'http://localhost:8081',
      optimistWsUrl: 'ws://localhost:8082',
      adversarialOptimistApiUrl: 'http://localhost:8088',
      adversarialOptimistWsUrl: 'ws://localhost:8089',
      web3WsUrl: 'ws://localhost:8546',
    },
  },
  TEST_OPTIONS: {
    tokenConfigs: {
      tokenId: '0x00',
      tokenType: 'ERC20', // it can be 'ERC721' or 'ERC1155'
      tokenTypeERC721: 'ERC721',
      tokenTypeERC1155: 'ERC1155',
    },
    transferValue: 10,
    // this is the etherum private key for accounts[0]
    privateKey: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
    gas: 10000000,
    gasCosts: 15000000000000000,
    fee: 1,
    BLOCK_STAKE: 1, // 1 wei
    bond: 10, // 10 wei
    txPerBlock: 2,
    signingKeys: {
      walletTest: '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      user1: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
      user2: '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      proposer1: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
      proposer2: '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      proposer3: '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6',
      challenger: '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      liquidityProvider: '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6',
    },
    mnemonics: {
      user1: 'trip differ bamboo bundle bonus luxury strike mad merry muffin nose auction',
      user2: 'control series album tribe category saddle prosper enforce moon eternal talk fame',
      proposer: 'high return hold whale promote payment hat panel reduce oyster ramp mouse',
      challenger: 'crush power outer gadget enter maze advance rather divert monster indoor axis',
      liquidityProvider: 'smart base soup sister army address member poem point quick save penalty',
    },
    restrictions: {
      erc20default: 2000,
    },
  },
  RESTRICTIONS: [
    {
      name: 'MockERC20',
      address: '0xB5Acbe9a0F1F8B98F3fC04471F7fE5d2c222cB44',
      amount: 200,
    },
  ],
};
