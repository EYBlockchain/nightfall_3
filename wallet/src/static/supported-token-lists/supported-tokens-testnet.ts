const tokensList = {
  tokens: [
    {
      chainId: 5,
      name: 'Ether - ERC20 Mock',
      symbol: 'ETH',
      decimals: 18,
      address: '0x3f152B63Ec5CA5831061B2DccFb29a874C317502',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/eth.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx'],
      id: 'ethereum',
      restrictions: {
        withdraw: '1000000000000000000',
        deposit: '250000000000000000',
      },
      extensions: {
        parentAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        project: {
          name: '-',
          summary: '-',
          contact: '-',
          website: 'https://weth.io/',
        },
      },
    },
    {
      chainId: 5,
      name: 'Matic Token',
      symbol: 'MATIC',
      decimals: 18,
      address: '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/matic.svg',
      tags: ['plasma', 'erc20', 'swapable'],
      id: 'matic-network',
      restrictions: {
        withdraw: '1000000000000000000000',
        deposit: '250000000000000000000',
      },
      extensions: {
        parentAddress: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
        project: {
          name: 'Polygon',
          summary: '-',
          contact: 'support@polygon.technology',
          website: 'https://polygon.technology',
        },
      },
    },
    {
      chainId: 5,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      address: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/usdc.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx', 'stablecoin'],
      id: 'usd-coin',
      restrictions: {
        withdraw: '1000000000',
        deposit: '250000000',
      },
      extensions: {
        parentAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        project: {
          name: 'Centre',
          summary: '-',
          contact: '-',
          website: 'https://www.centre.io',
        },
      },
    },
    {
      chainId: 5,
      name: 'Staked MATIC',
      symbol: 'stMATIC',
      decimals: 18,
      address: '0x9A7c69A167160C507602ecB3Df4911e8E98e1279',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/matic.svg',
      tags: ['pos', 'erc20'],
      id: 'stmatic',
      restrictions: {
        withdraw: '1000000000',
        deposit: '250000000',
      },
      extensions: {
        parentAddress: '0x3E46BEFDA7112d8954b923ea6bd9f07c2e615e10',
        project: {
          name: 'Staked MATIC',
          summary: '-',
          contact: '-',
          website: 'https://docs.polygon.lido.fi/',
        },
      },
    },
    // {
    //   chainId: 5,
    //   name: 'Tether USD',
    //   symbol: 'USDT',
    //   decimals: 6,
    //   address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    //   logoURI: 'https://wallet-asset.matic.network/img/tokens/usdt.svg',
    //   tags: ['pos', 'stablecoin', 'erc20', 'swapable', 'metaTx'],
    //   id: 'tether',
    //   extensions: {
    //     parentAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    //     project: {
    //       name: 'Tether',
    //       summary: '-',
    //       contact: 'support@tether.to',
    //       website: 'https://tether.to/',
    //     },
    //   },
    // },
    // {
    //   chainId: 5,
    //   name: 'Dai',
    //   symbol: 'DAI',
    //   decimals: 18,
    //   address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
    //   logoURI: 'https://wallet-asset.matic.network/img/tokens/dai.svg',
    //   tags: ['pos', 'stablecoin', 'erc20', 'swapable', 'metaTx'],
    //   id: 'dai',
    //   extensions: {
    //     parentAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //     project: {
    //       name: '-',
    //       summary: '-',
    //       contact: '-',
    //       website: 'https://makerdao.com/',
    //     },
    //   },
    // },
  ],
};

export default tokensList;
