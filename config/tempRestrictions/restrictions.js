module.exports = {
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
    edge: [
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
};
