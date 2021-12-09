/* ignore unused exports */
import * as Nf3 from 'nf3';
import * as tokenActions from './token.actions';
import * as Storage from '../../utils/lib/local-storage';

const getTokens = tokens => {
  if (tokens === null || typeof tokens === 'undefined' || Object.keys(tokens).length === 0)
    return [];
  if (Array.isArray(tokens)) return tokens;
  return Object.keys(tokens).map(el => {
    return {
      tokenAddress: `0x${el.replace('0x', '')}`,
      tokenBalanceL2: tokens[el].toString(),
      tokenName: '',
    };
  });
};

const getDetails = (balanceDetails, depositDetails, spentDetails, address) => {
  if (address.length === 0) return [];
  const l2Details = [];
  address.forEach(el => {
    l2Details.push({
      tokenAddress: el,
      tokenName: '',
      tokenBalanceL2: '0',
      tokenPendingDepositL2: '0',
      tokenPendingSpentL2: '0',
    });
  });
  Object.keys(balanceDetails).forEach(elBalanceAddress => {
    const detailElIndex = l2Details.findIndex(
      elDetails => elDetails.tokenAddress === elBalanceAddress,
    );
    if (detailElIndex !== -1) {
      l2Details[detailElIndex].tokenBalanceL2 = balanceDetails[elBalanceAddress].toString();
    }
  });
  Object.keys(depositDetails).forEach(elDepositAddress => {
    const detailElIndex = l2Details.findIndex(
      elDetails => elDetails.tokenAddress === elDepositAddress,
    );
    if (detailElIndex !== -1) {
      l2Details[detailElIndex].tokenPendingDepositL2 = depositDetails[elDepositAddress].toString();
    }
  });
  Object.keys(spentDetails).forEach(elSpentAddress => {
    const detailElIndex = l2Details.findIndex(
      elDetails => elDetails.tokenAddress === elSpentAddress,
    );
    if (detailElIndex !== -1) {
      l2Details[detailElIndex].tokenPendingSpentL2 = spentDetails[elSpentAddress].toString();
    }
  });
  return l2Details;
};

const mergeTokens = (tokens1, tokens2) => {
  const tokenPool = [...tokens2].map(token => {
    const obj = { ...token };
    obj.tokenBalanceL2 = '0';
    obj.tokenPendingDepositL2 = '0';
    obj.tokenPendingSpentL2 = '0';
    return obj;
  });
  for (const token1 of tokens1) {
    const duplicatedIndex = tokens2.findIndex(
      token2 => token2.tokenAddress === token1.tokenAddress,
    );
    if (duplicatedIndex === -1) {
      tokenPool.push(token1);
    } else {
      tokenPool[duplicatedIndex].tokenBalanceL2 = token1.tokenBalanceL2;
      tokenPool[duplicatedIndex].tokenPendingDepositL2 = token1.tokenPendingDepositL2;
      tokenPool[duplicatedIndex].tokenPendingSpentL2 = token1.tokenPendingSpentL2;
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
    const l2PendingDeposit = await nf3.getLayer2PendingDepositBalances();
    const l2PendingSpent = await nf3.getLayer2PendingSpentBalances();
    nf3
      .getLayer2Balances()
      .then(l2Balance => {
        const { compressedPkd } = nf3.zkpKeys;
        const myL2Balance =
          typeof l2Balance[compressedPkd] === 'undefined' ? {} : l2Balance[compressedPkd];
        const myL2PendingDeposit =
          typeof l2PendingDeposit[compressedPkd] === 'undefined'
            ? {}
            : l2PendingDeposit[compressedPkd];
        const myL2PendingSpent =
          typeof l2PendingSpent[compressedPkd] === 'undefined' ? {} : l2PendingSpent[compressedPkd];

        const l2Details = getDetails(myL2Balance, myL2PendingDeposit, myL2PendingSpent, [
          ...new Set([
            ...Object.keys(myL2Balance),
            ...Object.keys(myL2PendingDeposit),
            ...Object.keys(myL2PendingSpent),
          ]),
        ]);
        const tokenPool = mergeTokens(getTokens(l2Details), [
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
              tokenType: el.tokenType,
            })
              .then(tokenInfo => {
                nf3
                  .getLayer2BalancesDetails([el.tokenAddress])
                  .then(tokenL2Details => {
                    let l2TokenId = null;
                    if (el.tokenBalanceL2 !== '0') {
                      l2TokenId = tokenL2Details[nf3.zkpKeys.compressedPkd][el.tokenAddress].map(
                        l2Token => l2Token.tokenId.toString(),
                      );
                    } else {
                      l2TokenId = [];
                    }
                    const l1TokenId = tokenInfo.details.map(tokenDetails => tokenDetails.tokenId);
                    dispatch(
                      tokenActions.addToken(
                        compressedPkd,
                        el.tokenAddress.toLowerCase(),
                        el.tokenType,
                        l1TokenId,
                        l2TokenId,
                        el.tokenName,
                        tokenInfo.balance,
                        Nf3.Units.fromBaseUnit(el.tokenBalanceL2, tokenInfo.decimals),
                        Nf3.Units.fromBaseUnit(el.tokenPendingDepositL2, tokenInfo.decimals),
                        Nf3.Units.fromBaseUnit(el.tokenPendingSpentL2, tokenInfo.decimals),
                      ),
                    );
                  })
                  .catch(console.log);
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
