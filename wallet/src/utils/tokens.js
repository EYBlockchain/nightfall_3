/* ignore unused exports */
import * as Nf3 from 'nf3';
import { DEFAULT_TOKEN_ADDRESS, DEFAULT_TOKEN_ID } from '../constants';

const tokens = [
  {
    // id: 1,
    tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC20,
    tokenType: Nf3.Constants.TOKEN_TYPE.ERC20,
    tokenId: DEFAULT_TOKEN_ID.ERC20,
    tokenName: 'TOKEN1',
    tokenBalanceL1: '-',
    tokenBalanceL2: '-',
    // decimals: 9,
  },
  // DUMMY
  {
    // id: 2,
    tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC721,
    tokenType: Nf3.Constants.TOKEN_TYPE.ERC721,
    tokenId: DEFAULT_TOKEN_ID.ERC721,
    tokenName: 'TOKEN2',
    tokenBalanceL1: '-',
    tokenBalanceL2: '-',
    // decimals: 9,
  },
  // DUMMY
  {
    // id: 3,
    tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC1155,
    tokenType: Nf3.Constants.TOKEN_TYPE.ERC1155,
    tokenId: DEFAULT_TOKEN_ID.ERC1155,
    tokenName: 'TOKEN3',
    tokenBalanceL1: '-',
    tokenBalanceL2: '-',
    // decimals: 9,
  },
];

export default tokens;
