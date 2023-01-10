import localTokens from '@TokenList/supported-tokens-local';
import testnetTokens from '@TokenList/supported-tokens-testnet';
import mainnetTokens from '@TokenList/supported-tokens-mainnet';
import TokenType from './TokenType';
import { ChainIdMapping } from '../../common-files/utils/web3';

const supportedTokens = (): TokenType[] => {
  // const result = obj1.key != undefined ? obj2[obj1.key as keyof typeof obj2] : '';
  switch (ChainIdMapping[process.env.REACT_APP_MODE as keyof typeof ChainIdMapping].chainName) {
    // switch (process.env.REACT_APP_MODE) {
    case 'Mainnet':
      return mainnetTokens.tokens;
    case 'Ganache':
      return localTokens.tokens;
    default: {
      return testnetTokens.tokens;
    }
  }
};

export default supportedTokens;
