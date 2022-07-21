function configureAWSBucket() {
  const bucket = 'nightfallv3';
  const mode = process.env.REACT_APP_MODE; // options are 'local', 'internal', 'preprod', 'production', 'staging', and 'testnet'
  if (mode === 'local') return bucket;
  return `${bucket}-${mode}`;
}

/* eslint-disable no-extend-native */
BigInt.prototype.toJSON = function () {
  return `${this.toString()} BigInt`;
};

module.exports = {
  COMMITMENTS_DB: 'nightfall_commitments',
  OPTIMIST_DB: 'optimist_data',
  PROPOSER_COLLECTION: 'proposers',
  CHALLENGER_COLLECTION: 'challengers',
  TRANSACTIONS_COLLECTION: 'transactions',
  SUBMITTED_BLOCKS_COLLECTION: 'blocks',
  NULLIFIER_COLLECTION: 'nullifiers',
  COMMIT_COLLECTION: 'commits',
  WALLETS_COLLECTION: 'wallets',
  COMMITMENTS_COLLECTION: 'commitments',
  PEERS_COLLECTION: 'peers',
  TIMBER_COLLECTION: 'timber',
  CIRCUIT_COLLECTION: 'circuit_storage',
  CLIENT_ID_COLLECTION: 'client_id',
  CONTRACT_ARTIFACTS: '/app/build/contracts',
  PROPOSERS_CONTRACT_NAME: 'Proposers',
  SHIELD_CONTRACT_NAME: 'Shield',
  CHALLENGES_CONTRACT_NAME: 'Challenges',
  STATE_CONTRACT_NAME: 'State',
  STATE_GENESIS_BLOCK: process.env.STATE_GENESIS_BLOCK,
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
  WEBSOCKET_PING_TIME: 15000,
  ZOKRATES_WORKER_HOST: process.env.ZOKRATES_WORKER_HOST || 'worker',
  BLOCKCHAIN_URL:
    process.env.BLOCKCHAIN_URL ||
    `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}`,
  ETH_PRIVATE_KEY: process.env.ETH_PRIVATE_KEY, // owner's/deployer's private key
  ETH_ADDRESS: process.env.ETH_ADDRESS,
  WEB3_OPTIONS: {
    gas: process.env.GAS || 8000000,
    gasPrice: process.env.GAS_PRICE || '20000000000',
    from: process.env.FROM_ADDRESS || process.env.ETH_ADDRESS,
  },
  WEB3_PROVIDER_OPTIONS: {
    clientConfig: {
      // Useful to keep a connection alive
      keepalive: true,
      // Keep keepalive interval small so that socket doesn't die
      keepaliveInterval: 1500,
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
  BLOCK_TYPES: '(uint48,address,bytes32,uint256,bytes32,bytes32)',
  TRANSACTION_TYPES:
    '(uint112,uint64[2],uint8,uint8,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],bytes32[8],uint[4])',
  PROPOSE_BLOCK_TYPES: [
    '(uint48,address,bytes32,uint256,bytes32,bytes32)',
    '(uint112,uint64[2],uint8,uint8,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],bytes32[8],uint[4])[]',
  ], // used to encode/decode proposeBlock signature
  SUBMIT_TRANSACTION_TYPES:
    '(uint112,uint64[2],uint8,uint8,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],bytes32[8],uint[4])',
  RETRIES: Number(process.env.AUTOSTART_RETRIES) || 600,
  NODE_HASHLENGTH: 32,
  ZERO: '0x0000000000000000000000000000000000000000000000000000000000000000',
  HASH_TYPE: 'mimc',
  TXHASH_TREE_HASH_TYPE: 'keccak256',
  USE_STUBS: process.env.USE_STUBS === 'true',
  VK_IDS: { deposit: 0, single_transfer: 1, double_transfer: 2, withdraw: 3 }, // used as an enum to mirror the Shield contracts enum for vk types. The keys of this object must correspond to a 'folderpath' (the .zok file without the '.zok' bit)
  TIMBER_HEIGHT: 32,
  TXHASH_TREE_HEIGHT: 5,
  MAX_PUBLIC_VALUES: {
    ERCADDRESS: 2n ** 161n - 1n,
    COMMITMENT: 2n ** 249n - 1n,
    NULLIFIER: 2n ** 249n - 1n,
  },
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
  MPC: {
    MPC_PARAMS_URL:
      'https://nightfallv3-proving-files.s3.eu-west-1.amazonaws.com/phase2/mpc_params',
  },
  DEPLOYMENT_FILES_URL: {
    DEFAULT_CIRCUIT_FILES_URL: 'https://nightfallv3-proving-files.s3.eu-west-1.amazonaws.com',
    DEFAULT_CONTRACT_FILES_URL: 'https://nightfallv3-proving-files.s3.eu-west-1.amazonaws.com',
  },
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
      clientApiUrl: process.env.CLIENT_HOST
        ? `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`
        : 'http://localhost:8080',
      optimistApiUrl: process.env.OPTIMIST_HOST
        ? `http://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_PORT}`
        : 'http://localhost:8081',
      optimistWsUrl: process.env.OPTIMIST_HOST
        ? `ws://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_WS_PORT}`
        : 'ws://localhost:8082',
      proposerBaseUrl: process.env.PROPOSER_HOST
        ? `http://${process.env.PROPOSER_HOST}:${process.env.PROPOSER_PORT}`
        : 'http://localhost:8092',
      adversarialOptimistApiUrl: 'http://localhost:8088',
      adversarialOptimistWsUrl: 'ws://localhost:8089',
      web3WsUrl:
        // eslint-disable-next-line no-nested-ternary
        process.env.BLOCKCHAIN_WS_HOST && process.env.BLOCKCHAIN_PORT
          ? `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}`
          : process.env.BLOCKCHAIN_WS_HOST
          ? `wss://${process.env.BLOCKCHAIN_WS_HOST}`
          : 'ws://localhost:8546',
    },
    aws: {
      name: 'AWS',
      clientApiUrl: `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`,
      optimistApiUrl: `https://${process.env.OPTIMIST_HTTP_HOST}`,
      optimistWsUrl: `wss://${process.env.OPTIMIST_HOST}`,
      proposerBaseUrl: `https://${process.env.PROPOSER_HOST}`,
      web3WsUrl: `wss://${process.env.BLOCKCHAIN_WS_HOST}`,
    },
  },
  TEST_OPTIONS: {
    tokenConfigs: {
      tokenId: '0x00',
      tokenType: 'ERC20', // it can be 'ERC721' or 'ERC1155'
      tokenTypeERC721: 'ERC721',
      tokenTypeERC1155: 'ERC1155',
    },
    transferValue: process.env.TRANSFER_VALUE || 10,
    privateKey: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
    gas: 10000000,
    gasCosts: 80000000000000000,
    fee: 1,
    BLOCK_STAKE: 1, // 1 wei
    bond: 10, // 10 wei
    txPerBlock: process.env.TRANSACTIONS_PER_BLOCK || 2,
    signingKeys: {
      walletTest:
        process.env.WALLET_TEST_KEY ||
        '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      user1:
        process.env.USER1_KEY ||
        '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
      user2:
        process.env.USER2_KEY ||
        '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      proposer1:
        process.env.BOOT_PROPOSER_KEY ||
        '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
      proposer2:
        process.env.PROPOSER2_KEY ||
        '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      proposer3:
        process.env.PROPOSER3_KEY ||
        '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6',
      challenger:
        process.env.BOOT_CHALLENGER_KEY ||
        '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      liquidityProvider:
        process.env.LIQUIDITY_PROVIDER_KEY ||
        '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6',
    },
    addresses: {
      walletTest: process.env.WALLET_TEST_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
      user1: process.env.USER1_ADDRESS || '0x9C8B2276D490141Ae1440Da660E470E7C0349C63',
      user2: process.env.USER2_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
      proposer1: process.env.BOOT_PROPOSER_ADDRESS || '0xfeEDA3882Dd44aeb394caEEf941386E7ed88e0E0',
      proposer2: process.env.PROPOSER2_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
      proposer3: process.env.PROPOSER3_ADDRESS || '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
      challenger:
        process.env.BOOT_CHALLENGER_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
      liquidityProvider:
        process.env.LIQUIDITY_PROVIDER_ADDRESS || '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
    },
    pkds: {
      user1:
        process.env.USER1_PKD ||
        '0x0d27fb8112bf3274e27094ab05cc72db4d573ba081a659c3210a7bdbc1a9ec48',
      user2:
        process.env.USER2_PKD ||
        '0xaa3b5bbf25ee9aab94757487d21c9da7a1166f1cf1f65162c23579149eba8590',
    },
    mnemonics: {
      user1:
        process.env.USER1_MNEMONIC ||
        'trip differ bamboo bundle bonus luxury strike mad merry muffin nose auction',
      user2:
        process.env.USER2_MNEMONIC ||
        'control series album tribe category saddle prosper enforce moon eternal talk fame',
      proposer:
        process.env.BOOT_PROPOSER_MNEMONIC ||
        'high return hold whale promote payment hat panel reduce oyster ramp mouse',
      challenger:
        process.env.BOOT_CHALLENGER_MNEMONIC ||
        'crush power outer gadget enter maze advance rather divert monster indoor axis',
      liquidityProvider:
        process.env.LIQUIDITY_PROVIDER_MNEMONIC ||
        'smart base soup sister army address member poem point quick save penalty',
    },
    restrictions: {
      erc20default: process.env.ERC20_RESTRICTION || 100000000000,
    },
  },
  RESTRICTIONS: {
    signingKeys: {
      bootProposerKey:
        process.env.BOOT_PROPOSER_KEY ||
        '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
      bootChallengerKey:
        process.env.BOOT_CHALLENGER_KEY ||
        '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
    },
    addresses: {
      bootProposer:
        process.env.BOOT_PROPOSER_ADDRESS || '0xfeEDA3882Dd44aeb394caEEf941386E7ed88e0E0',
      bootChallenger:
        process.env.BOOT_CHALLENGER_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
    },
    tokens: {
      blockchain1: [
        {
          name: 'ERC20Mock',
          address: '0x9b7bD670D87C3Dd5C808ba627c75ba7E88aD066f',
          amount: '100000000000',
        },
        {
          name: 'Test-Eth',
          address: '0x3f152B63Ec5CA5831061B2DccFb29a874C317502',
          amount: '10000000000000000000000',
        },
        {
          name: 'MATIC',
          address: '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
          amount: '10000000000000000000000',
        },
        {
          name: 'USDC',
          address: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
          amount: '1000000000000',
        },
      ],
      staging: [
        {
          name: 'ERC20Mock',
          address: '0xB5Acbe9a0F1F8B98F3fC04471F7fE5d2c222cB44',
          amount: '100000000000',
        },
        {
          name: 'Test-Eth',
          address: '0x3f152B63Ec5CA5831061B2DccFb29a874C317502',
          amount: '10000000000000000000000',
        },
        {
          name: 'MATIC',
          address: '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
          amount: '10000000000000000000000',
        },
        {
          name: 'USDC',
          address: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
          amount: '1000000000000',
        },
      ],
      development: [
        {
          name: 'ERC20Mock',
          address: '0x470556dE5865D293dCcc0b47644fac7721168065',
          amount: '100000000000',
        },
        {
          name: 'Test-Eth',
          address: '0x3f152B63Ec5CA5831061B2DccFb29a874C317502',
          amount: '10000000000000000000000',
        },
        {
          name: 'MATIC',
          address: '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
          amount: '10000000000000000000000',
        },
        {
          name: 'USDC',
          address: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
          amount: '1000000000000',
        },
      ],
      mainnet: [
        {
          name: 'WETH',
          address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          amount: process.env.WETH_MAINNET_RESTRICT || '1000000000000000000',
        },
        {
          name: 'MATIC',
          address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
          amount: process.env.MATIC_MAINNET_RESTRICT || '1000000000000000000000',
        },
        {
          name: 'USDC',
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          amount: process.env.USDC_MAINNET_RESTRICT || '1000000000',
        },
        {
          name: 'USDT',
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          amount: process.env.USDT_MAINNET_RESTRICT || '1000000000',
        },
        {
          name: 'DAI',
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          amount: process.env.DAI_MAINNET_RESTRICT || '1000000000000000000000',
        },
      ],
      goerli: [
        {
          name: 'WETH',
          address: '0x3f152B63Ec5CA5831061B2DccFb29a874C317502',
          amount: process.env.WETH_TESTNET_RESTRICT || '1000000000000000000',
        },
        {
          name: 'MATIC',
          address: '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
          amount: process.env.MATIC_TESTNET_RESTRICT || '1000000000000000000000',
        },
        {
          name: 'USDC',
          address: '0x07865c6E87B9F70255377e024ace6630C1Eaa37F',
          amount: process.env.USDC_TESTNET_RESTRICT || '1000000000',
        },
      ],
      ropsten: [
        {
          name: 'WETH',
          address: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
          amount: process.env.WETH_TESTNET_RESTRICT || '1000000000000000000',
        },
        {
          name: 'MATIC',
          address: '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
          amount: process.env.MATIC_TESTNET_RESTRICT || '1000000000000000000000',
        },
        {
          name: 'USDC',
          address: '0x07865c6E87B9F70255377e024ace6630C1Eaa37F',
          amount: process.env.USDC_TESTNET_RESTRICT || '1000000000',
        },
      ],
    },
  },

  // for Browser use
  proposerUrl:
    process.env.LOCAL_PROPOSER === 'true'
      ? process.env.LOCAL_API_URL
      : process.env.PROPOSER_API_URL,

  eventWsUrl:
    process.env.LOCAL_PROPOSER === 'true' ? process.env.LOCAL_WS_URL : process.env.PROPOSER_WS_URL,

  KEYS_COLLECTION: 'keys',
  DEFAULT_ACCOUNT_NUM: 10,
  circuitsAWSFiles: {
    deposit_stub: {
      abi: 'circuits/deposit_stub/artifacts/deposit_stub-abi.json',
      program: 'circuits/deposit_stub/artifacts/deposit_stub-program',
      pk: 'circuits/deposit_stub/keypair/deposit_stub_pk.key',
    },
    withdraw_stub: {
      abi: 'circuits/withdraw_stub/artifacts/withdraw_stub-abi.json',
      program: 'circuits/withdraw_stub/artifacts/withdraw_stub-program',
      pk: 'circuits/withdraw_stub/keypair/withdraw_stub_pk.key',
    },
    single_transfer_stub: {
      abi: 'circuits/single_transfer_stub/artifacts/single_transfer_stub-abi.json',
      program: 'circuits/single_transfer_stub/artifacts/single_transfer_stub-program',
      pk: 'circuits/single_transfer_stub/keypair/single_transfer_stub_pk.key',
    },
    double_transfer_stub: {
      abi: 'circuits/double_transfer_stub/artifacts/double_transfer_stub-abi.json',
      program: 'circuits/double_transfer_stub/artifacts/double_transfer_stub-program',
      pk: 'circuits/double_transfer_stub/keypair/double_transfer_stub_pk.key',
    },
    deposit: {
      abi: 'circuits/deposit/artifacts/deposit-abi.json',
      program: 'circuits/deposit/artifacts/deposit-program',
      pk: 'circuits/deposit/keypair/deposit_pk.key',
    },
    withdraw: {
      abi: 'circuits/withdraw/artifacts/withdraw-abi.json',
      program: 'circuits/withdraw/artifacts/withdraw-program',
      pk: 'circuits/withdraw/keypair/withdraw_pk.key',
    },
    single_transfer: {
      abi: 'circuits/single_transfer/artifacts/single_transfer-abi.json',
      program: 'circuits/single_transfer/artifacts/single_transfer-program',
      pk: 'circuits/single_transfer/keypair/single_transfer_pk.key',
    },
    double_transfer: {
      abi: 'circuits/double_transfer/artifacts/double_transfer-abi.json',
      program: 'circuits/double_transfer/artifacts/double_transfer-program',
      pk: 'circuits/double_transfer/keypair/double_transfer_pk.key',
    },
  },

  AWS: {
    s3Bucket: configureAWSBucket(),
  },

  utilApiServerUrl: process.env.LOCAL_UTIL_API_URL,

  // assumption is if LOCAL_PROPOSER is true, wallet UI app
  // is running in local machine
  isLocalRun: process.env.LOCAL_PROPOSER === 'true',

  // AMAZONMQ
  usernameMq: process.env.USERNAME_MQ,
  pswMQ: process.env.PASSWORD_MQ,
};
