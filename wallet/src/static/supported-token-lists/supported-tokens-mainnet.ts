const tokensList = {
  tokens: [
    {
      chainId: 1,
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/eth.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx'],
      id: 'ethereum',
      tokenId: '0',
      restrictions: {
        withdraw: '1000000000000000000',
        deposit: '250000000000000000',
      },
      extensions: {
        parentAddress: '',
        project: {
          name: '-',
          summary: '-',
          contact: '-',
          website: 'https://weth.io/',
        },
      },
    },
    {
      chainId: 1,
      name: 'Matic Token',
      symbol: 'MATIC',
      decimals: 18,
      address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/matic.svg',
      tags: ['plasma', 'erc20', 'swapable'],
      id: 'matic-network',
      tokenId: '0',
      restrictions: {
        withdraw: '1000000000000000000000',
        deposit: '250000000000000000000',
      },
      extensions: {
        parentAddress: '',
        project: {
          name: 'Polygon',
          summary: '-',
          contact: 'support@polygon.technology',
          website: 'https://polygon.technology',
        },
      },
    },
    {
      chainId: 1,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/usdc.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx', 'stablecoin'],
      id: 'usd-coin',
      tokenId: '0',
      restrictions: {
        withdraw: '1000000000',
        deposit: '250000000',
      },
      extensions: {
        parentAddress: '',
        project: {
          name: 'Centre',
          summary: '-',
          contact: '-',
          website: 'https://www.centre.io',
        },
      },
    },
    // {
    //   chainId: 1,
    //   name: 'Tether USD',
    //   symbol: 'USDT',
    //   decimals: 6,
    //   address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    //   logoURI: 'https://wallet-asset.matic.network/img/tokens/usdt.svg',
    //   tags: ['pos', 'stablecoin', 'erc20', 'swapable', 'metaTx'],
    //   id: 'tether',
    //   tokenId: '0',
    //   restrictions: {
    //     withdraw: '1000000000',
    //     deposit: '250000000',
    //   },
    //   extensions: {
    //     parentAddress: '',
    //     project: {
    //       name: 'Tether',
    //       summary: '-',
    //       contact: 'support@tether.to',
    //       website: 'https://tether.to/',
    //     },
    //   },
    // },
    {
      chainId: 1,
      name: 'Dai',
      symbol: 'DAI',
      decimals: 18,
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/dai.svg',
      tags: ['pos', 'stablecoin', 'erc20', 'swapable', 'metaTx'],
      id: 'dai',
      tokenId: '0',
      restrictions: {
        withdraw: '1000000000000000000000',
        deposit: '250000000000000000000',
      },
      extensions: {
        parentAddress: '',
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
