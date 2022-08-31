import localTokens from '@TokenList/supported-tokens-local';
import testnetTokens from '@TokenList/supported-tokens-testnet';
import mainnetTokens from '@TokenList/supported-tokens-mainnet';
import TokenType from './TokenType';

const supportedTokens = (): TokenType[] => {
  switch (process.env.REACT_APP_MODE) {
    case 'internal':
    case 'testnet':
    case 'preprod':
    case 'staging':
      return testnetTokens.tokens;
    case 'production':
    case 'mainnet':
      return mainnetTokens.tokens;
    default: {
      return localTokens.tokens;
    }
  }
};

export default supportedTokens;
