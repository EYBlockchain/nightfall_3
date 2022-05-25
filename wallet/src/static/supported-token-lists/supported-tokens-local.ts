const tokensList = {
  tokens: [
    {
      chainId: 5,
      name: 'Ether - ERC20 Mock',
      symbol: 'ETH',
      decimals: 9,
      address: '0x17E1009e6Eab141615811104795D98c316d97AC0',
      logoURI: 'https://wallet-asset.matic.network/img/tokens/eth.svg',
      tags: ['pos', 'erc20', 'swapable', 'metaTx'],
      id: 'ethereum',
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
