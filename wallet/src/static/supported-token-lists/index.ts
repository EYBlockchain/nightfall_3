import localTokens from '@TokenList/supported-tokens-local';
import testnetTokens from '@TokenList/supported-tokens-testnet';
import mainnetTokens from '@TokenList/supported-tokens-mainnet';
import edgeTokens from '@TokenList/supported-tokens-edge';
import TokenType from './TokenType';
import { ChainIdMapping } from '../../common-files/utils/web3';

const supportedTokens = (): TokenType[] => {
  switch (
    ChainIdMapping[process.env.REACT_APP_MODE?.replace('-', '_') as keyof typeof ChainIdMapping]
      .chainName
  ) {
    case 'Mainnet':
      return mainnetTokens.tokens;
    case 'Ganache':
      return localTokens.tokens;
    case 'Edge':
      return edgeTokens.tokens;
    default: {
      return testnetTokens.tokens;
    }
  }
};

export default supportedTokens;
