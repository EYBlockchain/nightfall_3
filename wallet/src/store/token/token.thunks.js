/* ignore unused exports */
import * as Nf3 from 'nf3';
import * as tokenActions from './token.actions';
import * as Storage from '../../utils/lib/local-storage';
import {
  getWalletBalance,
  getWalletBalanceDetails,
  getWalletPendingDepositBalance,
  getWalletPendingSpentBalance,
} from '../../nightfall-browser/services/commitment-storage';

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
      tokenDetailsL2: {
        l2BalanceDetails: [],
        l2PendingDepositDetails: [],
        l2PendingSpentDetails: [],
      },
    });
  });
  Object.keys(balanceDetails).forEach(elBalanceAddress => {
    const detailElIndex = l2Details.findIndex(
      elDetails => elDetails.tokenAddress === elBalanceAddress,
    );
    if (detailElIndex !== -1) {
      l2Details[detailElIndex].tokenBalanceL2 = balanceDetails[elBalanceAddress][0].toString();
      l2Details[detailElIndex].tokenDetailsL2.l2BalanceDetails =
        balanceDetails[elBalanceAddress].slice(1);
    }
  });
  Object.keys(depositDetails).forEach(elDepositAddress => {
    const detailElIndex = l2Details.findIndex(
      elDetails => elDetails.tokenAddress === elDepositAddress,
    );
    if (detailElIndex !== -1) {
      l2Details[detailElIndex].tokenPendingDepositL2 =
        depositDetails[elDepositAddress][0].toString();
      l2Details[detailElIndex].tokenDetailsL2.l2PendingDepositDetails =
        depositDetails[elDepositAddress].slice(1);
    }
  });
  Object.keys(spentDetails).forEach(elSpentAddress => {
    const detailElIndex = l2Details.findIndex(
      elDetails => elDetails.tokenAddress === elSpentAddress,
    );
    if (detailElIndex !== -1) {
      l2Details[detailElIndex].tokenPendingSpentL2 = spentDetails[elSpentAddress][0].toString();
      l2Details[detailElIndex].tokenDetailsL2.l2PendingSpentDetails =
        spentDetails[elSpentAddress].slice(1);
    }
  });
  return l2Details;
};

const mergeTokens = (tokens1, tokens2) => {
  const tokenPool = [...tokens2].map(token => {
    const obj = { ...token };
    obj.tokenBalanceL2 = '0';
    obj.tokenName = token.tokenName;
    obj.tokenPendingDepositL2 = '0';
    obj.tokenPendingSpentL2 = '0';
    obj.tokenDetailsL2 = {
      l2BalanceDetails: [],
      l2PendingDepositDetails: [],
      l2PendingSpentDetails: [],
    };
    obj.tokenErc1155Details = token.tokenErc1155Details;
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
      tokenPool[duplicatedIndex].tokenDetailsL2 = token1.tokenDetailsL2;
      tokenPool[duplicatedIndex].tokenErc1155Details = token1.tokenErc1155Details;
    }
  }
  return tokenPool;
};

const mergeErc1155Details = details => {
  // map L1 details
  const tokenInfo = { ...details };
  if (!tokenInfo.tokenErc1155Details) {
    tokenInfo.tokenErc1155Details = [];
  }

  // L1 balance
  details.tokenDetailsL1.forEach(el => {
    const l1BalanceIndex = tokenInfo.tokenErc1155Details.findIndex(
      el2 => el2.tokenId === el.tokenId.toString(),
    );
    if (l1BalanceIndex === -1) {
      tokenInfo.tokenErc1155Details.push({
        tokenId: el.tokenId.toString(),
        l1Balance: el.amount,
        l2Balance: '0',
        pendingDeposit: '0',
        pendingSpent: '0',
      });
    } else {
      tokenInfo.tokenErc1155Details[l1BalanceIndex].l1Balance = el.amount;
    }
  });

  // L2 balance
  details.tokenDetailsL2.l2BalanceDetails.forEach(el => {
    const l2BalanceIndex = tokenInfo.tokenErc1155Details.findIndex(
      el2 => el2.tokenId === el.tokenId.toString(),
    );
    if (l2BalanceIndex === -1) {
      tokenInfo.tokenErc1155Details.push({
        tokenId: el.tokenId.toString(),
        l1Balance: '0',
        l2Balance: Nf3.Units.fromBaseUnit(el.balance.toString(), details.decimals),
        pendingDeposit: '0',
        pendingSpent: '0',
      });
    } else {
      tokenInfo.tokenErc1155Details[l2BalanceIndex].l2Balance = Nf3.Units.fromBaseUnit(
        el.balance.toString(),
        details.decimals,
      );
    }
  });

  // L2 pending deposits
  details.tokenDetailsL2.l2PendingDepositDetails.forEach(el => {
    const l2PendingDepositIndex = tokenInfo.tokenErc1155Details.findIndex(
      el2 => el2.tokenId === el.tokenId.toString(),
    );
    if (l2PendingDepositIndex === -1) {
      tokenInfo.tokenErc1155Details.push({
        tokenId: el.tokenId.toString(),
        l1Balance: '0',
        l2Balance: '0',
        pendingDeposit: Nf3.Units.fromBaseUnit(el.balance.toString(), details.decimals),
        pendingSpent: '0',
      });
    } else {
      tokenInfo.tokenErc1155Details[l2PendingDepositIndex].pendingDeposit = Nf3.Units.fromBaseUnit(
        el.balance.toString(),
        details.decimals,
      );
    }
  });
  // L2 pending spent
  details.tokenDetailsL2.l2PendingSpentDetails.forEach(el => {
    const l2PendingSpentIndex = tokenInfo.tokenErc1155Details.findIndex(
      el2 => el2.tokenId === el.tokenId.toString(),
    );
    if (l2PendingSpentIndex === -1) {
      tokenInfo.tokenErc1155Details.push({
        tokenId: el.tokenId.toString(),
        l1Balance: '0',
        l2Balance: '0',
        pendingDeposit: '0',
        pendingSpent: Nf3.Units.fromBaseUnit(el.balance.toString(), details.decimals),
      });
    } else {
      tokenInfo.tokenErc1155Details[l2PendingSpentIndex].pendingSpent = Nf3.Units.fromBaseUnit(
        el.balance.toString(),
        details.decimals,
      );
    }
  });

  return tokenInfo;
};

function tokensLoad(initTokens) {
  return async (dispatch, getState) => {
    const {
      login: { nf3 },
    } = getState();

    if (typeof nf3.ethereumAddress === 'undefined') return;
    const storedTokens = Storage.tokensGet(nf3.zkpKeys.compressedPkd);
    const l2PendingDeposit = await getWalletPendingDepositBalance();
    const l2PendingSpent = await getWalletPendingSpentBalance();
    getWalletBalance()
      .then(l2Balance => {
        console.log(`L2 BALANCE: ${JSON.stringify(l2Balance)}`);
        const { compressedPkd } = nf3.zkpKeys;
        const myL2Balance =
          typeof l2Balance[compressedPkd] === 'undefined' ? {} : l2Balance[compressedPkd];
        console.log(`myL2Balance: ${JSON.stringify(myL2Balance)}`);
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
        console.log(`L2Details: ${JSON.stringify(l2Details)}`);
        const tokenPool = mergeTokens(getTokens(l2Details), [
          ...getTokens(storedTokens),
          ...getTokens(initTokens),
        ]);
        if (tokenPool.length) {
          tokenPool.forEach(el => {
            // TODO: Pending retrieve tokenIds
            Nf3.Tokens.getERCInfo(el.tokenAddress, nf3.ethereumAddress, nf3.web3, {
              toEth: true,
              tokenId: 0,
              details: true,
              tokenType: el.tokenType,
            })
              .then(tokenInfo => {
                getWalletBalanceDetails(nf3.zkpKeys.compressedPkd, [el.tokenAddress])
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
        // TODO: Pending retrieve tokenIds and token name
        Nf3.Tokens.getERCInfo(tokenInfo.tokenAddress, nf3.ethereumAddress, nf3.web3, {
          toEth: true,
          tokenId: 0,
          details: true,
          tokenType: tokenInfo.tokenType,
        })
          .then(el1 => {
            tokenInfo.tokenDetailsL1 = el1.details;
            tokenInfo.decimals = el1.decimals;
            tokenInfo.tokenBalanceL1 = el1.balance;
            tokenInfo.tokenIdL1 = el1.details.map(tokenDetails => tokenDetails.tokenId);
            tokenInfo.tokenBalanceL2 = Nf3.Units.fromBaseUnit(
              tokenInfo.tokenBalanceL2,
              tokenInfo.decimals,
            );
            tokenInfo.tokenPendingDepositL2 = Nf3.Units.fromBaseUnit(
              tokenInfo.tokenPendingDepositL2,
              tokenInfo.decimals,
            );
            tokenInfo.tokenPendingSpentL2 = Nf3.Units.fromBaseUnit(
              tokenInfo.tokenPendingSpentL2,
              tokenInfo.decimals,
            );
            if (tokenInfo.tokenType === Nf3.Constants.TOKEN_TYPE.ERC1155) {
              tokenInfo = mergeErc1155Details(tokenInfo);
            }
            dispatch(tokenActions.addToken(compressedPkd, tokenInfo));
          })
          .catch(console.log);
      });
    }
  };
}

export default tokensLoad;
