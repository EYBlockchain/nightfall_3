/* ignore unused exports */
import * as Nf3 from 'nf3';
import * as tokenActions from './token.actions';
import * as Storage from '../../utils/lib/local-storage';

const getTokens = tokens => {
  if (tokens === null || Object.keys(tokens).length === 0) return [];
  if (Array.isArray(tokens)) return tokens;
  return Object.keys(tokens).map(el => {
    return {
      tokenAddress: `0x${el.replace('0x', '')}`,
      tokenBalanceL2: tokens[el].toString(),
      tokenName: '',
    };
  });
};

const mergeTokens = (tokens1, tokens2) => {
  const tokenPool = [...tokens2];
  for (const token1 of tokens1) {
    const duplicatedIndex = tokens2.findIndex(
      token2 => token2.tokenAddress === token1.tokenAddress,
    );
    if (duplicatedIndex === -1) {
      tokenPool.push(token1);
    } else if (tokenPool[duplicatedIndex].tokenBalanceL2 !== token1.tokenBalanceL2) {
      tokenPool[duplicatedIndex].tokenBalanceL2 = token1.tokenBalanceL2;
      tokenPool[duplicatedIndex].updated = true;
    }
  }
  return tokenPool;
};

function tokensLoad(initTokens) {
  return async (dispatch, getState) => {
    const {
      login: { nf3 },
    } = getState();

    if (typeof nf3.ethereumAddress === 'undefined') return;
    const storedTokens = Storage.tokensGet(nf3.zkpKeys.compressedPkd);
    nf3
      .getLayer2Balances()
      .then(l2Balance => {
        const { compressedPkd } = nf3.zkpKeys;
        const myL2Balance =
          typeof l2Balance[compressedPkd] === 'undefined' ? {} : l2Balance[compressedPkd];

        const tokenPool = mergeTokens(getTokens(myL2Balance), [
          ...getTokens(storedTokens),
          ...getTokens(initTokens),
        ]);

        if (tokenPool.length) {
          tokenPool.forEach(el => {
            // TODO: Pending retrieve tokenIds and token name
            Nf3.Tokens.getERCInfo(el.tokenAddress, nf3.ethereumAddress, nf3.web3, {
              toEth: true,
              tokenId: 0,
              details: true,
            })
              .then(tokenInfo => {
                const tokenIdL1 = tokenInfo.details.map(tokenDetails => tokenDetails.tokenId);
                if (
                  el.tokenBalanceL1 !== tokenInfo.balance ||
                  el.updated ||
                  JSON.stringify(el.tokenId) !== JSON.stringify(tokenIdL1)
                ) {
                  dispatch(
                    tokenActions.addToken(
                      compressedPkd,
                      el.tokenAddress.toLowerCase(),
                      el.tokenType,
                      tokenInfo.details.map(tokenDetails => tokenDetails.tokenId),
                      el.tokenName,
                      tokenInfo.balance,
                      Nf3.Units.fromBaseUnit(el.tokenBalanceL2, tokenInfo.decimals),
                    ),
                  );
                }
              })
              .catch(console.log());
          });
        }
      })
      // TODO fix this
      .catch(console.log);
  };
}

export default tokensLoad;
