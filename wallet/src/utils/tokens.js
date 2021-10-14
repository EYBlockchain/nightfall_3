import { DEFAULT_TOKEN_ADDRESS, TOKEN_TYPE, DEFAULT_TOKEN_ID } from '../constants';

const tokens = [
  {
    id: 1,
    tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC20,
    tokenType: TOKEN_TYPE.ERC20,
    tokenId: DEFAULT_TOKEN_ID.ERC20,
    tokenName: '',
    tokenBalanceL1: 10,
    tokenBalanceL2: 2,
  },
  // DUMMY
  {
    id: 2,
    tokenAddress: 2,
    tokenType: 'ERC721',
    tokenId: DEFAULT_TOKEN_ID.ERC721,
    tokenName: '',
    tokenBalanceL1: 10,
    tokenBalanceL2: 2,
  },
  // DUMMY
  {
    id: 3,
    tokenAddress: 3,
    tokenType: 'ERC1155',
    tokenId: DEFAULT_TOKEN_ID.ERC1155,
    tokenName: '',
    tokenBalanceL1: 0,
    tokenBalanceL2: 20,
  },
];
export default { tokens };
