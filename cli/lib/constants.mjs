export const TOKEN_TYPE = {
  ERC20: 'ERC20',
  ERC721: 'ERC721',
  ERC1155: 'ERC1155',
};

export const TX_TYPES = {
  DEPOSIT: 'deposit',
  TRANSFER: 'transfer',
  WITHDRAW: 'withdraw',
  INSTANT_WITHDRAW: 'instant-withdraw',
};

export const APPROVE_AMOUNT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

export const ENVIRONMENTS = {
  mainnet: {
    name: 'Mainnet',
    chainId: 1,
    clientApiUrl: '',
    optimistApiUrl: '',
    optimistWsUrl: '',
  },
  ropsten: {
    name: 'Ropsten',
    chainId: 3,
    clientApiUrl: 'https://client1.testnet.nightfall3.com',
    optimistApiUrl: 'https://optimist1.testnet.nightfall3.com',
    optimistWsUrl: 'wss://optimist1-ws.testnet.nightfall3.com',
  },
  rinkeby: {
    name: 'Rinkeby',
    chainId: 4,
    clientApiUrl: '',
    optimistApiUrl: '',
    optimistWsUrl: '',
  },
  localhost: {
    name: 'Localhost',
    chainId: 4378921,
    clientApiUrl: 'http://localhost:8080',
    optimistApiUrl: 'http://localhost:8081',
    optimistWsUrl: 'ws://localhost:8082',
  },
};
