import localTokens from '@TokenList/supported-tokens-local';
import testnetTokens from '@TokenList/supported-tokens-testnet';
import TokenType from './TokenType';

const supportedTokens = (): TokenType[] => {
  switch (process.env.REACT_APP_MODE) {
    case 'testnet':
      return testnetTokens.tokens;
    case 'staging':
      return testnetTokens.tokens;
    default: {
      return localTokens.tokens;
    }
  }
};

export default supportedTokens;
