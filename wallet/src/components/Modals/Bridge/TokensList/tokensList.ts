const tokensList = {
  tokens: [
    {
      chainId: 137,
      name: 'Ether - ERC20 Mock',
      symbol: 'ETH',
      decimals: 9,
      address: '0xf05e9FB485502E5A93990C714560b7cE654173c3',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/eth.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx'],
      id: 'ethereum',
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
      chainId: 137,
      name: 'Matic Token',
      symbol: 'MATIC',
      decimals: 18,
      address: '0x0000000000000000000000000000000000001010',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/matic.svg',
      tags: ['plasma', 'erc20', 'swapable'],
      id: 'matic-network',
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
      chainId: 137,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/usdc.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx', 'stablecoin'],
      id: 'usd-coin',
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
      chainId: 137,
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/usdt.svg',
      tags: ['pos', 'stablecoin', 'erc20', 'swapable', 'metaTx'],
      id: 'tether',
      extensions: {
        parentAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        project: {
          name: 'Tether',
          summary: '-',
          contact: 'support@tether.to',
          website: 'https://tether.to/',
        },
      },
    },
    {
      chainId: 137,
      name: 'Dai',
      symbol: 'DAI',
      decimals: 18,
      address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/dai.svg',
      tags: ['pos', 'stablecoin', 'erc20', 'swapable', 'metaTx'],
      id: 'dai',
      extensions: {
        parentAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
        project: {
          name: '-',
          summary: '-',
          contact: '-',
          website: 'https://makerdao.com/',
        },
      },
    },
  ],
};

export default tokensList;
