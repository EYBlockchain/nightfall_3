/* ignore unused exports */
import { DEFAULT_TOKEN_ADDRESS, TOKEN_TYPE, DEFAULT_TOKEN_ID } from '../constants';

const tokens = [
  {
    id: 1,
    tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC20,
    tokenType: TOKEN_TYPE.ERC20,
    tokenId: DEFAULT_TOKEN_ID.ERC20,
    tokenName: '',
    tokenBalanceL1: '-',
    tokenBalanceL2: '-',
  },
  // DUMMY
  {
    id: 2,
    tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC721,
    tokenType: 'ERC721',
    tokenId: DEFAULT_TOKEN_ID.ERC721,
    tokenName: '',
    tokenBalanceL1: '-',
    tokenBalanceL2: '-',
  },
  // DUMMY
  {
    id: 3,
    tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC1155,
    tokenType: 'ERC1155',
    tokenId: DEFAULT_TOKEN_ID.ERC1155,
    tokenName: '',
    tokenBalanceL1: '-',
    tokenBalanceL2: '-',
  },
];
export default { tokens };
