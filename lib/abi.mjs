import { TOKEN_TYPE } from './constants.mjs';
import ERC20ABI from './abis/ERC20.mjs';
import ERC721ABI from './abis/ERC721.mjs';
import ERC1155ABI from './abis/ERC1155.mjs';
import ERC165 from './abis/ERC165.mjs';

function getAbi(tokenType) {
  switch (tokenType) {
    case TOKEN_TYPE.ERC20:
      return ERC20ABI;
    case TOKEN_TYPE.ERC721:
      return ERC721ABI;
    case TOKEN_TYPE.ERC1155:
      return ERC1155ABI;
    case TOKEN_TYPE.ERC165:
      return ERC165;
    default:
      return null;
  }
}

export default getAbi;
