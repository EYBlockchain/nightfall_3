const tokensList = {
  tokens: [
    {
      chainId: 5,
      name: 'Ether - ERC20 Mock',
      symbol: 'ETH',
      decimals: 9,
      address: '0xe721F2D97c58b1D1ccd0C80B88256a152d27f0Fe',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/eth.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx'],
      id: 'ethereum',
      tokenId: '0',
      restrictions: {
        withdraw: '1000000000',
        deposit: '250000000',
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
  ],
};

export default tokensList;
