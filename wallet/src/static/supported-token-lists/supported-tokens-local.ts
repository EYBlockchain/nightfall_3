const tokensList = {
  tokens: [
    {
      chainId: 5,
      name: 'Ether - ERC20 Mock',
      symbol: 'ETH',
      decimals: 9,
      address: '0x9b7bD670D87C3Dd5C808ba627c75ba7E88aD066f',
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
