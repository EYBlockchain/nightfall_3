function configureAWSBucket() {
  const bucket = 'nightfallv3';
  const mode = process.env.REACT_APP_MODE; // options are 'local', 'internal', 'preprod', 'production', 'staging', and 'testnet'
  if (mode === 'local') return bucket;
  return `${bucket}-${mode}`;
}

module.exports = {
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
  MAX_QUEUE: 10,
  TIMBER_HEIGHT: 32,
  TXHASH_TREE_HEIGHT: 5,
  CONFIRMATION_POLL_TIME: 1000,
  CONFIRMATIONS: process.env.CONFIRMATIONS || 12,
  DEFAULT_ACCOUNT_NUM: 10,
  HASH_TYPE: 'poseidon',
  TXHASH_TREE_HASH_TYPE: 'keccak256',
  STATE_GENESIS_BLOCK: process.env.STATE_GENESIS_BLOCK,
  CIRCUITS_HOME: process.env.CIRCUITS_HOME || '/app/circuits/',
  ALWAYS_DO_TRUSTED_SETUP: process.env.ALWAYS_DO_TRUSTED_SETUP || false,
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  LOG_HTTP_PAYLOAD_ENABLED: process.env.LOG_HTTP_PAYLOAD_ENABLED || 'true',
  LOG_HTTP_FULL_DATA: process.env.LOG_HTTP_FULL_DATA || 'false',
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
          '0xb9e9997dF5b3ac021AB3B29C64F3c339A2546816',
        ],
  },
  RSA_TRUST_ROOTS: [
    {
      modulus:
        '0x00c6cdaeb44c7b8fe697a3b8a269799176078ae3cb065010f55a1f1a839ff203b1e785d6782eb9c04e0e1cf63ec7ef21c6d3201c818647b8cea476112463caa8339f03e678212f0214c4a50de21cabc8001ef269eef4930fcd1dd2911ba40d505fcee5508bd91a79aadc70cc33c77be14908b1c32f880a8bb8e2d863838cfa6bd444c47dd30f78650caf1dd947adcf48b427536d294240d40335eaee5db31399b04b3893936cc41c04602b713603526a1e003112bf213e6f5a99830fa821783340c46597e481e1ee4c0c6b3aca32628b70886a396d737537bcfae5ba51dfd6add1728aa6bde5aeb8c27289fb8e911569a41c3e3f48b9b2671c673faac7f085a195',
      exponent: 65537,
      authorityKeyIdentifier: `0x${'ef355558d6fdee0d5d02a22d078e057b74644e5f'.padStart(64, '0')}`,
    },
  ],
  BLOCKCHAIN_URL:
    process.env.BLOCKCHAIN_URL ||
    `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}${
      process.env.BLOCKCHAIN_PATH || ''
    }`,
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
    timeout: 0,
    reconnect: {
      auto: true,
      delay: 5000, // ms
      maxAttempts: 120,
      onTimeout: false,
    },
  },
  PROVING_SCHEME: process.env.PROVING_SCHEME || 'groth16',
  BACKEND: process.env.BACKEND || 'bellman',
  CURVE: process.env.CURVE || 'bn128',

  MINIMUM_TRANSACTION_SLOTS: 16,
  MAX_BLOCK_SIZE: Number(process.env.MAX_BLOCK_SIZE) || 50000,
  RETRIES: Number(process.env.AUTOSTART_RETRIES) || 100,
  VK_IDS: {
    deposit: {
      numberNullifiers: 0,
      numberCommitments: 1,
      isEscrowRequired: true,
      isWithdrawing: false,
    },
    transfer: {
      numberNullifiers: 4,
      numberCommitments: 3,
      isEscrowRequired: false,
      isWithdrawing: false,
    },
    withdraw: {
      numberNullifiers: 4,
      numberCommitments: 2,
      isEscrowRequired: false,
      isWithdrawing: true,
    },
    tokenise: {
      numberNullifiers: 2,
      numberCommitments: 2,
      isEscrowRequired: false,
      isWithdrawing: false,
    },
    burn: {
      numberNullifiers: 3,
      numberCommitments: 2,
      isEscrowRequired: false,
      isWithdrawing: false,
    },
  }, // used as an enum to mirror the Shield contracts enum for vk types. The keys of this object must correspond to a 'folderpath' (the .zok file without the '.zok' bit)
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
      chainId: 1337,
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
          ? `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}${
              process.env.BLOCKCHAIN_PATH || ''
            }`
          : process.env.BLOCKCHAIN_WS_HOST
          ? `wss://${process.env.BLOCKCHAIN_WS_HOST}`
          : 'ws://localhost:8546',
      PROPOSER_KEY:
        process.env.PROPOSER_KEY ||
        process.env.BOOT_PROPOSER_KEY ||
        '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d', // owner's/deployer's private key
      CHALLENGER_KEY:
        process.env.CHALLENGER_KEY ||
        process.env.BOOT_CHALLENGER_KEY ||
        '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
    },
    aws: {
      name: 'AWS',
      chainId: 1337,
      clientApiUrl: `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`,
      optimistApiUrl: `https://${process.env.OPTIMIST_HTTP_HOST}`,
      optimistWsUrl: `wss://${process.env.OPTIMIST_HOST}`,
      proposerBaseUrl: `https://${process.env.PROPOSER_HOST}`,
      web3WsUrl: `wss://${process.env.BLOCKCHAIN_WS_HOST}${process.env.BLOCKCHAIN_PATH}`,
      adversarialOptimistApiUrl: `https://${process.env.OPTIMIST_HTTP_HOST}`,
      adversarialOptimistWsUrl: `wss://${process.env.OPTIMIST_HOST}`,
      PROPOSER_KEY: process.env.PROPOSER_KEY,
      CHALLENGER_KEY: process.env.CHALLENGER_KEY,
    },
    polygonEdge: {
      name: 'Polygon Edge',
      chainId: 100,
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
      web3WsUrl: `ws://localhost:10002/ws`,
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
    ROTATE_PROPOSER_BLOCKS: 20,
    txPerBlock: 2,
    signingKeys: {
      walletTest:
        process.env.WALLET_TEST_KEY ||
        '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
      user1:
        process.env.USER1_KEY ||
        '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
      user2:
        process.env.USER2_KEY ||
        '0x955ff4fac3c1ae8a1b7b9ff197476de1f93e9f0bf5f1c21ff16456e3c84da587',
      proposer1:
        process.env.BOOT_PROPOSER_KEY ||
        '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
      proposer2:
        process.env.PROPOSER2_KEY ||
        '0xabf4ed9f30bd1e4a290310d726c7bbdf39cd75a25eebd9a3a4874e10b4a0c4ce',
      proposer3:
        process.env.PROPOSER3_KEY ||
        '0xcbbf1d0686738a444cf9f66fdc96289035c384c4e8d26768f94fa81f3ab6596a',
      challenger:
        process.env.BOOT_CHALLENGER_KEY ||
        '0x1da216993fb96745dcba8bc6f2ef5deb75ce602fd92f91ab702d8250033f4e1c',
      liquidityProvider:
        process.env.LIQUIDITY_PROVIDER_KEY ||
        '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6',
    },
    addresses: {
      walletTest: process.env.WALLET_TEST_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
      user1: process.env.USER1_ADDRESS || '0x9C8B2276D490141Ae1440Da660E470E7C0349C63',
      user2: process.env.USER2_ADDRESS || '0xb9e9997dF5b3ac021AB3B29C64F3c339A2546816',
      proposer1: process.env.BOOT_PROPOSER_ADDRESS || '0xfeEDA3882Dd44aeb394caEEf941386E7ed88e0E0',
      proposer2: process.env.PROPOSER2_ADDRESS || '0xa12D5C4921518980c57Ce3fFe275593e4BAB9211',
      proposer3: process.env.PROPOSER3_ADDRESS || '0xdb080dC48961bC1D67a0A4151572eCb824cC76E8',
      challenger:
        process.env.BOOT_CHALLENGER_ADDRESS || '0xFFF578cDdc48792522F4a7Fdc3973Ec0d41A831f',
      liquidityProvider:
        process.env.LIQUIDITY_PROVIDER_ADDRESS || '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
    },
    zkpPublicKeys: {
      user1:
        process.env.USER1_COMPRESSED_ZKP_PUBLIC_KEY ||
        '0x236af0fee749dd191e317fc8199f20c5b3df728bd3247db0623c3085e7ff501a',
      user2:
        process.env.USER2_COMPRESSED_ZKP_PUBLIC_KEY ||
        '0x8b1cd14f2defec7928cc958e2dfbc86fbd3218e25a10807388a5db4b8fa4837e',
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
      blockchain: [
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
      staging_edge: [
        {
          name: 'ERC20Mock',
          address: '0x7578E001dCF334F48a87dA44e30C7ab3b517a5B8',
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
        {
          name: 'stMATIC',
          address: '0x9A7c69A167160C507602ecB3Df4911e8E98e1279',
          amount: process.env.STMATIC_TESTNET_RESTRICT || '1000000000',
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

  AWS: {
    s3Bucket: configureAWSBucket(),
  },

  utilApiServerUrl: process.env.LOCAL_UTIL_API_URL,

  // assumption is if LOCAL_PROPOSER is true, wallet UI app
  // is running in local machine
  isLocalRun: process.env.LOCAL_PROPOSER === 'true',
  SIGNATURES: {
    BLOCK: '(uint256,bytes32,bytes32,bytes32, bytes32)',
    TRANSACTION:
      '(uint256,uint256[],bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes32[2],uint256[4])',
    PROPOSE_BLOCK: [
      '(uint256,bytes32,bytes32,bytes32,bytes32)',
      '(uint256,uint256[],bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes32[2],uint256[4])[]',
    ],
    SUBMIT_TRANSACTION:
      '(uint256,uint256[],bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes32[2],uint256[4])',
  },
};
